// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { 
  AppConfigurationClient, 
  ConfigurationSetting, 
  SetConfigurationSettingParam, 
  FeatureFlagValue, 
  SecretReferenceValue } from "@azure/app-configuration";
import { ConfigurationSettingsSource } from "./settingsImport/configurationSettingsSource";
import { ConfigurationChangesSource } from "./settingsImport/configurationChangesSource";
import { ImportMode, ChangeType } from "./enums";
import { OperationTimeoutError, ArgumentError } from "./errors";
import { AdaptiveTaskManager } from "./internal/adaptiveTaskManager";
import { ImportProgress, ConfigurationSettingChange } from "./models";
import { isConfigSettingEqual } from "./internal/utils";
import { v4 as uuidv4 } from "uuid";
import { Constants } from "./internal/constants";
import { OperationOptions } from "@azure/core-client";
import { ImportOptions } from "./options";

/**
 * Entrypoint class for sync configuration
 */
export class AppConfigurationImporter {
  private configurationClient: AppConfigurationClient;
  /**
   * Initializes a new instance of the AppConfigurationSync class.
   * @param configurationClient - App configuration client for manipulate the target App Configuration.
   */
  constructor(configurationClient: AppConfigurationClient) {
    this.configurationClient = configurationClient;
  }

  /**
   * Import settings into the Azure App Configuration service.
   * 
   * Example usage:
   * ```ts
   * const fileData = fs.readFileSync("mylocalPath").toString();
   * const source = new StringConfigurationSettingsSource({data:fileData, format: ConfigurationFormat.Json});
   * await importer.Import(source, { timeout: 60 });
   * ```
   * 
   * @param configurationSettingsSource - A ConfigurationSettingsSource instance.
   * @param options - Import options including timeout, progress callback, strict mode, and import mode.
   * @returns Promise<void>
   */
  public async Import(
    configurationSettingsSource: ConfigurationSettingsSource,
    options: ImportOptions
  ): Promise<void> {
    if (configurationSettingsSource instanceof ConfigurationChangesSource) {
      // When using ConfigurationChanges, strict and importMode parameters are not applicable
      if (options?.strict || options?.importMode) {
        throw new ArgumentError("Parameters 'strict' and 'importMode' are not applicable when importing pre-calculated changes.");
      }
    }

    // Generate correlationRequestId for operations in the same activity
    const customCorrelationRequestId: string = uuidv4();
    const customHeadersOption: OperationOptions = {
      requestOptions: {
        customHeaders: {
          [Constants.CorrelationRequestIdHeader]: customCorrelationRequestId
        }
      }
    };

    const configurationChanges = await this.GetConfigurationChanges(configurationSettingsSource, options?.strict, options?.importMode, customHeadersOption);
    
    const settingsToWrite: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[] = configurationChanges
      .filter(c => (c.changeType === ChangeType.Create || c.changeType === ChangeType.Update || c.changeType === ChangeType.None) && c.newValue)
      .map(c => c.newValue!);

    const settingsToDelete: ConfigurationSetting[] = configurationChanges
      .filter(c => c.changeType === ChangeType.Delete && c.currentValue)
      .map(c => c.currentValue!);

    return await this.applyUpdatesToServer(settingsToWrite, settingsToDelete, options.timeout, customHeadersOption, options.progressCallback);
  }

  /**
   * Get configuration changes between source settings and existing settings in Azure App Configuration service without applying any changes
   *
   * Example usage:
   * ```ts
   * const fileData = fs.readFileSync("mylocalPath").toString();
   * const configurationChanges = await client.GetConfigurationChanges(
   *   new StringConfigurationSettingsSource({data:fileData, format: ConfigurationFormat.Json}),
   *   false,
   *   ImportMode.All,
   *   options
   * );
   * ```
   * @param configSettingsSource - A ConfigurationSettingsSource instance.
   * @param strict - Use strict mode to delete settings not in source.
   * @param importMode - Determines the behavior when analyzing key-values.
   *  'All' will include all key-values. 
   *  'Ignore-Match' will exclude settings that have matching key-values in App Configuration.
   * @param customHeadersOption - Custom headers for the operation.
   * @returns Array of ConfigurationSettingChange objects representing the changes
   */
  public async GetConfigurationChanges(
    configSettingsSource: ConfigurationSettingsSource,
    strict = false,
    importMode = ImportMode.IgnoreMatch,
    customHeadersOption?: OperationOptions
  ): Promise<Array<ConfigurationSettingChange>> {
    this.validateImportMode(importMode);

    // Generate correlationRequestId for operations in the same activity
    if (!customHeadersOption) {
      const customCorrelationRequestId: string = uuidv4();
      customHeadersOption = {
        requestOptions: {
          customHeaders: {
            [Constants.CorrelationRequestIdHeader]: customCorrelationRequestId
          }
        }
      };
    }

    const configSettingsResult = await configSettingsSource.GetConfigurationSettings();

    // If the source returns ConfigurationChanges (e.g., ConfigurationChangesSource), 
    // return them directly without further processing since changes are already calculated
    if (this.isConfigurationChanges(configSettingsResult)) {
      return configSettingsResult as Array<ConfigurationSettingChange>;
    }

    const configSettings = configSettingsResult as Array<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>>;
    const configurationChanges: Array<ConfigurationSettingChange> = [];

    // Build O(1) lookup structures keyed by "key\0label" composite.
    const srcMap = new Map<string, SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>>();
    const toAddKeys = new Set<string>();
    for (const config of configSettings) {
      const composite = `${config.key}\u0000${config.label ?? ""}`;
      srcMap.set(composite, config);
      toAddKeys.add(composite);
    }

    // Stream target settings so we don't hold the entire remote store in memory.
    for await (const existing of this.configurationClient.listConfigurationSettings({
      ...configSettingsSource.FilterOptions,
      ...customHeadersOption
    })) {
      const composite = `${existing.key}\u0000${existing.label ?? ""}`;
      const incoming = srcMap.get(composite);

      if (strict && !incoming) {
        configurationChanges.push({
          changeType: ChangeType.Delete,
          currentValue: existing,
          newValue: null
        });
      }

      if (incoming) {
        // Remove from add list since it already exists
        toAddKeys.delete(composite);

        if (!isConfigSettingEqual(incoming, existing)) {
          configurationChanges.push({
            changeType: ChangeType.Update,
            currentValue: existing,
            newValue: incoming
          });
        }
        else if (importMode === ImportMode.All) {
          configurationChanges.push({
            changeType: ChangeType.None,
            currentValue: existing,
            newValue: incoming
          });
        }
      }
    }

    for (const composite of toAddKeys) {
      configurationChanges.push({
        changeType: ChangeType.Create,
        currentValue: null,
        newValue: srcMap.get(composite)!
      });
    }

    return configurationChanges;
  }

  private async applyUpdatesToServer(
    settingsToPut: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[], 
    settingsToDelete: ConfigurationSetting<string>[],
    timeout: number,
    options: OperationOptions,
    progressCallback?: (progress: ImportProgress) => unknown | undefined
  ): Promise<void> {
    const deleteTaskManager = this.newAdaptiveTaskManager((setting) => this.configurationClient.deleteConfigurationSetting(setting, options), settingsToDelete);
    const startTime = Date.now();
    await this.executeTasksWithTimeout(deleteTaskManager, timeout);
    const endTime = Date.now();
    const deleteTimeConsumed = (endTime - startTime) / 1000;
    timeout -= deleteTimeConsumed;

    const importTaskManager = this.newAdaptiveTaskManager((setting) => this.configurationClient.setConfigurationSetting(setting, options), settingsToPut);
    await this.executeTasksWithTimeout(importTaskManager, timeout, progressCallback);
  }

  private newAdaptiveTaskManager<T>(task: (setting: T) => Promise<any>, configurationSettings: Array<T>) {
    let index = 0;
    return new AdaptiveTaskManager(() => {
      if (index == configurationSettings.length) {
        return undefined;
      }
      const configSet = configurationSettings[index++];

      return async () => {
        return task(configSet);
      };
    }, configurationSettings.length);
  }

  private async executeTasksWithTimeout<T>(taskManager: AdaptiveTaskManager<T>, timeInSeconds: number, callback?: (progress: ImportProgress) => unknown) {
    let timer: NodeJS.Timeout;
    const taskPromise = taskManager.Start(callback);
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new OperationTimeoutError()), timeInSeconds * 1000);
    });
    await Promise.race([taskPromise, timeoutPromise]).finally(() => {
      clearTimeout(timer); // clear timeout when importPromise successfully resolve or faultily reject.
    });
  }

  private validateImportMode(importMode: ImportMode): void {
    if (importMode && !(importMode == ImportMode.IgnoreMatch || 
      importMode == ImportMode.All)) {
      throw new ArgumentError("Only options supported for Import Mode are 'All' and 'Ignore-Match'.");
    }
  }

  /**
   * Type guard to detect a ConfigurationChanges object.
   * @internal
   */
  private isConfigurationChanges(obj: unknown): obj is Array<ConfigurationSettingChange> {
    if (!Array.isArray(obj)) {
      return false;
    }
    
    // Validate it's an array of ConfigurationSettingChange objects
    return obj.every(item => 
      item && 
      typeof item === "object" &&
      "changeType" in item &&
      "currentValue" in item &&
      "newValue" in item &&
      Object.values(ChangeType).includes(item.changeType)
    );
  }
}
