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
import { ImportMode } from "./enums";
import { OperationTimeoutError, ArgumentError } from "./errors";
import { AdaptiveTaskManager } from "./internal/adaptiveTaskManager";
import { ImportProgress, KeyLabelLookup, ConfigurationChanges } from "./models";
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

    return await this.applyUpdatesToServer([...configurationChanges.ToAdd, ...configurationChanges.ToModify, ...configurationChanges.ToRefresh], configurationChanges.ToDelete, options.timeout, customHeadersOption, options.progressCallback);
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
   * @returns ConfigurationChanges object containing Added, Modified, and Deleted settings
   */
  public async GetConfigurationChanges(
    configSettingsSource: ConfigurationSettingsSource,
    strict = false,
    importMode = ImportMode.IgnoreMatch,
    customHeadersOption?: OperationOptions
  ): Promise<ConfigurationChanges> {
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
      return configSettingsResult as ConfigurationChanges;
    }
  
    const configSettings = configSettingsResult as Array<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>>;
    const configurationSettingToDelete: ConfigurationSetting<string>[] = [];
    const configurationSettingToModify: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[] = [];
    const configurationSettingToAdd: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[] = [];
    const configurationSettingToRefresh: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[] = [];
    const srcKeyLabelLookUp: KeyLabelLookup = {};
    
    configSettings.forEach((config: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>) => {
      if (!srcKeyLabelLookUp[config.key]) {
        srcKeyLabelLookUp[config.key] = {};
      }
      srcKeyLabelLookUp[config.key][config.label || ""] = true;
    });

    configurationSettingToAdd.push(...configSettings);

    for await (const existing of this.configurationClient.listConfigurationSettings({...configSettingsSource.FilterOptions, ...customHeadersOption})) {
      const isKeyLabelPresent: boolean = srcKeyLabelLookUp[existing.key] && srcKeyLabelLookUp[existing.key][existing.label || ""];
      if (strict && !isKeyLabelPresent) {
        configurationSettingToDelete.push(existing);
      }

      const incoming = configSettings.find(configSetting => configSetting.key == existing.key && configSetting.label === existing.label);

      if (incoming) {
        // Remove from add list since it already exists
        configurationSettingToAdd.splice(configurationSettingToAdd.indexOf(incoming), 1);

        if (!isConfigSettingEqual(incoming, existing)) {
          // Key-value has changed, add to ToModify
          configurationSettingToModify.push(incoming);
        } else if (importMode === ImportMode.All) {
          // Key-value is unchanged but importMode is All, add to ToRefresh
          configurationSettingToRefresh.push(incoming);
        }
      }
    }

    return {
      ToAdd: configurationSettingToAdd,
      ToModify: configurationSettingToModify,
      ToDelete: configurationSettingToDelete,
      ToRefresh: configurationSettingToRefresh
    };
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
  private isConfigurationChanges(obj: unknown): obj is ConfigurationChanges {
    if (obj === null || typeof obj !== "object") {
      return false;
    }
    const configChanges = obj as Partial<ConfigurationChanges>;
    return Array.isArray(configChanges.ToAdd) && 
           Array.isArray(configChanges.ToModify) && 
           Array.isArray(configChanges.ToDelete) && 
           Array.isArray(configChanges.ToRefresh);
  }
}
