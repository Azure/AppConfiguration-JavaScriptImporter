// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { 
  AppConfigurationClient, 
  ConfigurationSetting, 
  SetConfigurationSettingParam, 
  FeatureFlagValue, 
  SecretReferenceValue } from "@azure/app-configuration";
import { ConfigurationSettingsSource } from "./settingsImport/configurationSettingsSource";
import { ImportMode } from "./enums";
import { OperationTimeoutError, ArgumentError } from "./errors";
import { AdaptiveTaskManager } from "./internal/adaptiveTaskManager";
import { ImportProgress, KeyLabelLookup, ConfigurationDiff } from "./models";
import { isConfigSettingEqual } from "./internal/utils";
import { v4 as uuidv4 } from "uuid";
import { Constants } from "./internal/constants";
import { OperationOptions } from "@azure/core-client";

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
   * Import source settings into the Azure App Configuration service
   *
   * Example usage:
   * ```ts
   * const fileData = fs.readFileSync("mylocalPath").toString();
   * const result = await asyncClient.Import(new StringConfigurationSettingsSource({data:fileData, format: ConfigurationFormat.Json}));
   * ```
   * @param configSettingsSource - A ConfigurationSettingsSource instance.
   * @param strict - Use strict mode or not.
   * @param timeout - Seconds of entire import progress timeout
   * @param progressCallback - Callback for report the progress of import
   * @param importMode - Determines the behavior when importing key-values. The default value, 'All' will import all key-values in the input file to App Configuration. 'Ignore-Match' will only import settings that have no matching key-value in App Configuration.
   * @param dryRun - When enabled, no updates will be performed to App Configuration. Returns a ConfigurationDiff object and prints changes to console for review.
   * @returns ConfigurationDiff when dryRun=true, otherwise void
   */
  public async Import(
    configSettingsSource: ConfigurationSettingsSource,
    timeout: number,
    strict = false,
    progressCallback?: (progress: ImportProgress) => unknown,
    importMode?: ImportMode,
    dryRun?: boolean
  ): Promise<ConfigurationDiff | void> {
    if (importMode == undefined) {
      importMode = ImportMode.IgnoreMatch;
    }
    if (dryRun == undefined) {
      dryRun = false;
    }
    this.validateImportMode(importMode);
      
    // Generate correlation ID for operations
    const customCorrelationRequestId: string = uuidv4();
    const customHeadersOption: OperationOptions = {
      requestOptions: {
        customHeaders: {
          [Constants.CorrelationRequestIdHeader]: customCorrelationRequestId
        }
      }
    };

    const configurationDiff: ConfigurationDiff = await this.analyzeConfigurationChanges(configSettingsSource, strict, importMode, customHeadersOption);

    if (dryRun) {
      this.printUpdatesToConsole([...configurationDiff.Added, ...configurationDiff.Modified], configurationDiff.Deleted);
      return configurationDiff;
    }
    else {
      await this.applyUpdatesToServer(configurationDiff.Added, configurationDiff.Deleted, timeout, customHeadersOption, progressCallback);
    }
  }

  private async analyzeConfigurationChanges(
    configSettingsSource: ConfigurationSettingsSource,
    strict: boolean,
    importMode: ImportMode,
    customHeadersOption: OperationOptions
  ): Promise<ConfigurationDiff> {
    const configSettings = await configSettingsSource.GetConfigurationSettings();
    
    const configurationSettingToDelete: ConfigurationSetting<string>[] = [];
    const configurationSettingToModify: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[] = [];
    const configurationSettingToAdd: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[] = [];
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
     
      const incoming = configSettings.find(configSetting => configSetting.key == existing.key && 
        configSetting.label == existing.label);
      
      if (incoming) {
        const settingsAreEqual: boolean = isConfigSettingEqual(incoming, existing);
        
        if (!settingsAreEqual) {
          configurationSettingToModify.push(incoming);
          // Remove from add list since it's a modification, not an addition
          const addIndex: number = configurationSettingToAdd.findIndex(addSetting => 
            addSetting.key === incoming.key && addSetting.label === incoming.label);
          if (addIndex !== -1) {
            configurationSettingToAdd.splice(addIndex, 1);
          }
        }
        else if (importMode == ImportMode.IgnoreMatch) {
          // Remove unchanged settings from add list
          const addIndex = configurationSettingToAdd.findIndex(addSetting => 
            addSetting.key === incoming.key && addSetting.label === incoming.label);
          if (addIndex !== -1) {
            configurationSettingToAdd.splice(addIndex, 1);
          }
        }
      }
    }

    return {
      Added: configurationSettingToAdd,
      Modified: configurationSettingToModify,
      Deleted: configurationSettingToDelete
    };
  }

  private printUpdatesToConsole(
    settingsToAdd: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[], 
    settingsToDelete: ConfigurationSetting<string>[]
  ): void {
    console.log("The following settings will be removed from App Configuration:");
    for (const setting of settingsToDelete) {

      console.log(JSON.stringify({key: setting.key, label: setting.label, contentType: setting.contentType, tags: setting.tags}));
    } 

    console.log("\nThe following settings will be written to App Configuration:");
    for (const setting of settingsToAdd) {

      console.log(JSON.stringify({key: setting.key, label: setting.label, contentType: setting.contentType, tags: setting.tags}));
    }
  }

  private async applyUpdatesToServer(
    settingsToAdd: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[], 
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

    const importTaskManager = this.newAdaptiveTaskManager((setting) => this.configurationClient.setConfigurationSetting(setting, options), settingsToAdd);
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
}
