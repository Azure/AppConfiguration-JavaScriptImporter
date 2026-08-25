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
import { FeatureFlagSource } from "./settingsImport/featureFlagSource";
import { FeatureFlagChangesSource } from "./settingsImport/featureFlagChangesSource";

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
    if (featureFlagSource instanceof FeatureFlagChangesSource && (options?.strict || options?.importMode)) {
      throw new ArgumentError("Parameters 'strict' and 'importMode' are not applicable when importing pre-calculated changes.");
    }
    const customHeadersOption = createCorrelationOptions();
    const changes = await this.GetFeatureFlagChanges(
      featureFlagSource,
      options?.strict,
      options?.importMode,
      customHeadersOption
    );

    const flagsToWrite = changes
      .filter(change => (change.changeType === ChangeType.Create || change.changeType === ChangeType.Update || change.changeType === ChangeType.None) && change.newValue)
      .map(change => change.newValue!);

    const flagsToDelete = changes
      .filter(change => change.changeType === ChangeType.Delete && change.currentValue)
      .map(change => change.currentValue!);

    await this.applyUpdatesToServer(
      flagsToWrite,
      flagsToDelete,
      options.timeout,
      customHeadersOption,
      options.progressCallback
    );
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
    if (featureFlagSource instanceof FeatureFlagChangesSource) {
      return featureFlagSourceResult as FeatureFlagChange[];
    }

    // If the source returns ConfigurationChanges (e.g., ConfigurationChangesSource), 
    // return them directly without further processing since changes are already calculated
    if (isChangeArray<FeatureFlagChange>(featureFlagSourceResult)) {
      return featureFlagSourceResult;
    }

    const sourceMap = new Map<string, FeatureFlagParam>();
    const toAdd = new Set<string>();
    for (const featureFlag of featureFlagSourceResult) {
      const identity = getSettingIdentity(featureFlag.name, featureFlag.label);
      sourceMap.set(identity, featureFlag);
      toAdd.add(identity);
    }

    const featureFlagChanges: FeatureFlagChange[] = [];
    for await (const existing of this.featureFlagClient.listFeatureFlags({
      ...featureFlagSource.FeatureFlagFilterOptions,
      ...options
    })) {
      const identity = getSettingIdentity(existing.name, existing.label);
      const incoming = sourceMap.get(identity);
      if (strict && !incoming) {
        featureFlagChanges.push({
          changeType: ChangeType.Delete,
          currentValue: existing,
          newValue: null
        });
      }
      if (incoming) {
        toAdd.delete(identity);
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

    for (const identity of toAdd) {
      featureFlagChanges.push({
        changeType: ChangeType.Create,
        currentValue: null,
        newValue: sourceMap.get(identity)!
      });
    }
    return featureFlagChanges;
  }

  private async applyUpdatesToServer(
    flagsToWrite: FeatureFlagParam[],
    flagsToDelete: FeatureFlag[],
    timeout: number,
    options: OperationOptions,
    progressCallback?: (progress: ImportProgress) => unknown
  ): Promise<void> {
    const deleteManager = createAdaptiveTaskManager(
      featureFlag => this.featureFlagClient.deleteFeatureFlag(featureFlag, options),
      flagsToDelete
    );
    const startTime = Date.now();
    await executeTasksWithTimeout(deleteManager, timeout);
    timeout -= (Date.now() - startTime) / 1000;

    const writeManager = createAdaptiveTaskManager(
      featureFlag => this.featureFlagClient.setFeatureFlag(featureFlag, options),
      flagsToWrite
    );
    await executeTasksWithTimeout(writeManager, timeout, progressCallback);
  }
}