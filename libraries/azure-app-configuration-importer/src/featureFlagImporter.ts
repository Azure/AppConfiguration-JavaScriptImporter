// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlag, FeatureFlagClient, FeatureFlagParam } from "@azure/app-configuration";
import { OperationOptions } from "@azure/core-client";
import { v4 as uuidv4 } from "uuid";
import { ChangeType, ImportMode } from "./enums";
import { ArgumentError, OperationTimeoutError } from "./errors";
import { AdaptiveTaskManager } from "./internal/adaptiveTaskManager";
import { Constants } from "./internal/constants";
import { isEnhancedFeatureFlagEqual } from "./internal/utils";
import { FeatureFlagChange, ImportProgress } from "./models";
import { FeatureFlagImportOptions } from "./options";
import { FeatureFlagSource } from "./settingsImport/featureFlagSource";
import { FeatureFlagChangesSource } from "./settingsImport/featureFlagChangesSource";

/** Imports enhanced feature flags through the dedicated feature flag endpoint. */
export class FeatureFlagImporter {
  public constructor(private featureFlagClient: FeatureFlagClient) {}

  public async Import(source: FeatureFlagSource, options: FeatureFlagImportOptions): Promise<void> {
    if (source instanceof FeatureFlagChangesSource && (options?.strict || options?.importMode)) {
      throw new ArgumentError("Parameters 'strict' and 'importMode' are not applicable when importing pre-calculated changes.");
    }
    const customHeadersOption = this.createCorrelationOptions();
    const changes = await this.GetFeatureFlagChanges(
      source,
      options?.strict,
      options?.importMode,
      customHeadersOption
    );

    const flagsToDelete = changes
      .filter(change => change.changeType === ChangeType.Delete && change.currentValue)
      .map(change => change.currentValue!);
    const flagsToAdd = changes
      .filter(change => change.changeType === ChangeType.Create && change.newValue)
      .map(change => change.newValue!);
    const flagsToSet = changes
      .filter(change => (change.changeType === ChangeType.Update || change.changeType === ChangeType.None) && change.newValue)
      .map(change => change.newValue!);

    await this.applyUpdatesToServer(
      flagsToAdd,
      flagsToSet,
      flagsToDelete,
      options.timeout,
      customHeadersOption,
      options.progressCallback
    );
  }

  public async GetFeatureFlagChanges(
    source: FeatureFlagSource,
    strict = false,
    importMode = ImportMode.IgnoreMatch,
    customHeadersOption?: OperationOptions
  ): Promise<FeatureFlagChange[]> {
    this.validateImportMode(importMode);
    const options = customHeadersOption ?? this.createCorrelationOptions();
    const sourceResult = await source.GetFeatureFlags();
    if (source instanceof FeatureFlagChangesSource) {
      return sourceResult as FeatureFlagChange[];
    }
    if (this.isFeatureFlagChanges(sourceResult)) {
      return sourceResult;
    }

    const sourceMap = new Map<string, FeatureFlagParam>();
    const toAdd = new Set<string>();
    for (const featureFlag of sourceResult) {
      const identity = this.getIdentity(featureFlag);
      sourceMap.set(identity, featureFlag);
      toAdd.add(identity);
    }

    const changes: FeatureFlagChange[] = [];
    for await (const existing of this.featureFlagClient.listFeatureFlags({
      ...source.FeatureFlagFilterOptions,
      ...options
    })) {
      const identity = this.getIdentity(existing);
      const incoming = sourceMap.get(identity);
      if (strict && !incoming) {
        changes.push({ changeType: ChangeType.Delete, currentValue: existing, newValue: null });
      }
      if (incoming) {
        toAdd.delete(identity);
        if (!isEnhancedFeatureFlagEqual(incoming, existing)) {
          changes.push({ changeType: ChangeType.Update, currentValue: existing, newValue: incoming });
        }
        else if (importMode === ImportMode.All) {
          changes.push({ changeType: ChangeType.None, currentValue: existing, newValue: incoming });
        }
      }
    }

    for (const identity of toAdd) {
      changes.push({ changeType: ChangeType.Create, currentValue: null, newValue: sourceMap.get(identity)! });
    }
    return changes;
  }

  private async applyUpdatesToServer(
    flagsToAdd: FeatureFlagParam[],
    flagsToSet: FeatureFlagParam[],
    flagsToDelete: FeatureFlag[],
    timeout: number,
    options: OperationOptions,
    progressCallback?: (progress: ImportProgress) => unknown
  ): Promise<void> {
    const deleteManager = this.newAdaptiveTaskManager(
      featureFlag => this.featureFlagClient.deleteFeatureFlag(featureFlag, options),
      flagsToDelete
    );
    const startTime = Date.now();
    await this.executeTasksWithTimeout(deleteManager, timeout);
    timeout -= (Date.now() - startTime) / 1000;

    const writes = [
      ...flagsToAdd.map(featureFlag => () => this.featureFlagClient.addFeatureFlag(featureFlag, options)),
      ...flagsToSet.map(featureFlag => () => this.featureFlagClient.setFeatureFlag(featureFlag, options))
    ];
    let index = 0;
    const writeManager = new AdaptiveTaskManager(() => writes[index++], writes.length);
    await this.executeTasksWithTimeout(writeManager, timeout, progressCallback);
  }

  private newAdaptiveTaskManager<T>(task: (value: T) => Promise<any>, values: T[]): AdaptiveTaskManager<any> {
    let index = 0;
    return new AdaptiveTaskManager(() => {
      const value = values[index++];
      return value === undefined ? undefined : () => task(value);
    }, values.length);
  }

  private async executeTasksWithTimeout<T>(
    taskManager: AdaptiveTaskManager<T>,
    timeInSeconds: number,
    callback?: (progress: ImportProgress) => unknown
  ): Promise<void> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new OperationTimeoutError()), timeInSeconds * 1000);
    });
    await Promise.race([taskManager.Start(callback), timeoutPromise]).finally(() => clearTimeout(timer));
  }

  private createCorrelationOptions(): OperationOptions {
    return {
      requestOptions: {
        customHeaders: { [Constants.CorrelationRequestIdHeader]: uuidv4() }
      }
    };
  }

  private getIdentity(featureFlag: { name: string; label?: string }): string {
    return `${featureFlag.name}\u0000${featureFlag.label ?? ""}`;
  }

  private validateImportMode(importMode: ImportMode): void {
    if (importMode !== ImportMode.IgnoreMatch && importMode !== ImportMode.All) {
      throw new ArgumentError("Only options supported for Import Mode are 'All' and 'Ignore-Match'.");
    }
  }

  private isFeatureFlagChanges(value: FeatureFlagParam[] | FeatureFlagChange[]): value is FeatureFlagChange[] {
    return value.length > 0 && (value as unknown[]).every(item =>
      !!item && typeof item === "object" &&
      "changeType" in item && "currentValue" in item && "newValue" in item
    );
  }
}