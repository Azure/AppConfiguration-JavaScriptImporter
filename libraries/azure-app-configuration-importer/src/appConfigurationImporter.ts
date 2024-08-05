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
import { ImportProgress, KeyLabelLookup } from "./models";
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
   * @param dryRun - When dry run is enabled, no updates  will be performed to App Configuration. Instead, any updates that would have been performed in a normal run will be printed to the console for review
   */
  public async Import(
    configSettingsSource: ConfigurationSettingsSource,
    timeout: number,
    strict = false,
    progressCallback?: (progress: ImportProgress) => unknown,
    importMode?: ImportMode,
    dryRun?: boolean
  ) {
    if (importMode == undefined) {
      importMode = ImportMode.IgnoreMatch;
    }
    if (dryRun == undefined) {
      dryRun = false;
    }
    this.validateImportMode(importMode);

    const configSettings = await configSettingsSource.GetConfigurationSettings();

    const configurationSettingToDelete: ConfigurationSetting<string>[] = [];
    const srcKeyLabelLookUp: KeyLabelLookup = {};
    
    configSettings.forEach((config: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>) => {
      if (!srcKeyLabelLookUp[config.key]) {
        srcKeyLabelLookUp[config.key] = {};
      }
      srcKeyLabelLookUp[config.key][config.label || ""] = true;
    });

    // generate correlationRequestId for operations in the same activity
    const customCorrelationRequestId: string = uuidv4();
    const customHeadersOption: OperationOptions = {
      requestOptions: {
        customHeaders: {
          [Constants.CorrelationRequestIdHeader]: customCorrelationRequestId
        }
      }
    };

    if (strict || importMode == ImportMode.IgnoreMatch) {
      for await (const existing of this.configurationClient.listConfigurationSettings({...configSettingsSource.FilterOptions, ...customHeadersOption})) {

        const isKeyLabelPresent: boolean = srcKeyLabelLookUp[existing.key] && srcKeyLabelLookUp[existing.key][existing.label || ""];
        
        if (strict && !isKeyLabelPresent) {
          configurationSettingToDelete.push(existing);
        }
       
        if (importMode == ImportMode.IgnoreMatch) {
          const incoming = configSettings.find(configSetting => configSetting.key == existing.key && 
            configSetting.label == existing.label);
           
          if (incoming && isConfigSettingEqual(incoming, existing)) {
            configSettings.splice(configSettings.indexOf(incoming), 1);
          }
        }
      }
    }
   
    if (dryRun) {
      this.printUpdatesToConsole(configSettings, configurationSettingToDelete);
    }
    else {
      await this.applyUpdatesToServer(configSettings, configurationSettingToDelete, timeout, customHeadersOption, progressCallback);
    }
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
