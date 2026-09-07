// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlag, FeatureFlagClient, FeatureFlagParam } from "@azure/app-configuration";
import { OperationOptions } from "@azure/core-client";
import { ChangeType, ImportMode } from "./enums";
import { ArgumentError } from "./errors";
import {
  createAdaptiveTaskManager,
  createCorrelationOptions,
  executeTasksWithTimeout,
  getSettingIdentity,
  isChangeArray,
  isEnhancedFeatureFlagEqual,
  validateImportMode
} from "./internal/utils";
import { FeatureFlagChange, ImportProgress } from "./models";
import { FeatureFlagImportOptions } from "./options";
import { FeatureFlagSource } from "./settingsImport/featureFlag/featureFlagSource";
import { FeatureFlagChangesSource } from "./settingsImport/featureFlag/featureFlagChangesSource";

/**
 * Entrypoint class for importing enhanced feature flags through the dedicated feature flag endpoint.
 */
export class FeatureFlagImporter {
  /**
   * Initializes a new instance of the FeatureFlagImporter class.
   * @param featureFlagClient - Feature flag client used to manipulate the target App Configuration.
   */
  public constructor(private featureFlagClient: FeatureFlagClient) {}

  /**
   * Import enhanced feature flags into the Azure App Configuration service.
   *
   * Example usage:
   * ```ts
   * const source = new FeatureFlagSource(featureFlags);
   * await importer.Import(source, { timeout: 60 });
   * ```
   *
   * @param FeatureFlagSource - A FeatureFlagSource instance.
   * @param options - Import options including timeout, progress callback, strict mode, and import mode.
   * @returns Promise<void>
   */
  public async Import(featureFlagSource: FeatureFlagSource, options: FeatureFlagImportOptions): Promise<void> {
    if (featureFlagSource instanceof FeatureFlagChangesSource) {
      // When using FeatureFlagChanges, strict and importMode parameters are not applicable
      if (options?.strict || options?.importMode) {
        throw new ArgumentError("Parameters 'strict' and 'importMode' are not applicable when importing pre-calculated changes.");
      }
    }

    const customHeadersOption = createCorrelationOptions();

    const featureFlagChanges = await this.GetFeatureFlagChanges(featureFlagSource, options?.strict, options?.importMode, customHeadersOption);

    const flagsToWrite: FeatureFlagParam[] = featureFlagChanges
      .filter(c => (c.changeType === ChangeType.Create || c.changeType === ChangeType.Update || c.changeType === ChangeType.None) && c.newValue)
      .map(c => c.newValue!);

    const flagsToDelete: FeatureFlag[] = featureFlagChanges
      .filter(c => c.changeType === ChangeType.Delete && c.currentValue)
      .map(c => c.currentValue!);

    return await this.applyUpdatesToServer(flagsToWrite, flagsToDelete, options.timeout, customHeadersOption, options.progressCallback);
  }

  /**
   * Get feature flag changes between the source and Azure App Configuration without applying any changes.
   *
   * Example usage:
   * ```ts
   * const changes = await importer.GetFeatureFlagChanges(
   *   source,
   *   false,
   *   ImportMode.All,
   *   options
   * );
   * ```
   *
   * @param featureFlagSource - A FeatureFlagSource instance.
   * @param strict - Use strict mode to delete feature flags not in the source.
   * @param importMode - Determines the behavior when analyzing feature flags.
   *   'All' includes all feature flags.
   *   'Ignore-Match' excludes feature flags that match those in App Configuration.
   * @param customHeadersOption - Custom headers for the operation.
   * @returns FeatureFlagChange objects representing the changes.
   */
  public async GetFeatureFlagChanges(
    featureFlagSource: FeatureFlagSource,
    strict = false,
    importMode = ImportMode.IgnoreMatch,
    customHeadersOption?: OperationOptions
  ): Promise<FeatureFlagChange[]> {
    validateImportMode(importMode);
    const options = customHeadersOption ?? createCorrelationOptions();

    const featureFlagSourceResult = await featureFlagSource.GetFeatureFlags();

    // If the source returns FeatureFlagChanges (e.g., FeatureFlagChangesSource), 
    // return them directly without further processing since changes are already calculated
    if (isChangeArray<FeatureFlagChange>(featureFlagSourceResult)) {
      return featureFlagSourceResult;
    }

    const featureFlags = featureFlagSourceResult as Array<FeatureFlagParam>;
    const featureFlagChanges: Array<FeatureFlagChange> = [];

    // Build O(1) lookup structures keyed by "name\0label" composite.
    const srcMap = new Map<string, FeatureFlagParam>();
    const toAddKeys = new Set<string>();
    for (const featureFlag of featureFlags) {
      const composite = getSettingIdentity(featureFlag.name, featureFlag.label);
      srcMap.set(composite, featureFlag);
      toAddKeys.add(composite);
    }

    // Stream target feature flags so we don't hold the entire remote store in memory.
    for await (const existing of this.featureFlagClient.listFeatureFlags({
      ...featureFlagSource.FeatureFlagFilterOptions,
      ...options
    })) {
      const composite = getSettingIdentity(existing.name, existing.label);
      const incoming = srcMap.get(composite);

      if (strict && !incoming) {
        featureFlagChanges.push({
          changeType: ChangeType.Delete,
          currentValue: existing,
          newValue: null
        });
      }

      if (incoming) {
        // Remove from add list since it already exists
        toAddKeys.delete(composite);

        if (!isEnhancedFeatureFlagEqual(incoming, existing)) {
          featureFlagChanges.push({
            changeType: ChangeType.Update,
            currentValue: existing,
            newValue: incoming
          });
        }
        else if (importMode === ImportMode.All) {
          featureFlagChanges.push({
            changeType: ChangeType.None,
            currentValue: existing,
            newValue: incoming
          });
        }
      }
    }

    for (const composite of toAddKeys) {
      featureFlagChanges.push({
        changeType: ChangeType.Create,
        currentValue: null,
        newValue: srcMap.get(composite)!
      });
    }

    return featureFlagChanges;
  }

  private async applyUpdatesToServer(
    flagsToWrite: FeatureFlagParam[],
    flagsToDelete: FeatureFlag[],
    timeout: number,
    options: OperationOptions,
    progressCallback?: (progress: ImportProgress) => unknown | undefined
  ): Promise<void> {
    const deleteTaskManager = createAdaptiveTaskManager((featureFlag) => this.featureFlagClient.deleteFeatureFlag(featureFlag, options), flagsToDelete);
    const startTime = Date.now();
    await executeTasksWithTimeout(deleteTaskManager, timeout);
    const endTime = Date.now();
    const deleteTimeConsumed = (endTime - startTime) / 1000;
    timeout -= deleteTimeConsumed;

    const importTaskManager = createAdaptiveTaskManager((featureFlag) => this.featureFlagClient.setFeatureFlag(featureFlag, options), flagsToWrite);
    await executeTasksWithTimeout(importTaskManager, timeout, progressCallback);
  }
}