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
import { ArgumentError } from "./errors";
import { ImportProgress, ConfigurationSettingChange } from "./models";
import {
  createAdaptiveTaskManager,
  createCorrelationOptions,
  executeTasksWithTimeout,
  getSettingIdentity,
  isChangeArray,
  isConfigSettingEqual,
  validateImportMode
} from "./internal/utils";
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

    const customHeadersOption = createCorrelationOptions();

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
    validateImportMode(importMode);
    const options = customHeadersOption ?? createCorrelationOptions();

    const configSettingsResult = await configSettingsSource.GetConfigurationSettings();

    // If the source returns ConfigurationChanges (e.g., ConfigurationChangesSource), 
    // return them directly without further processing since changes are already calculated
    if (isChangeArray<ConfigurationSettingChange>(configSettingsResult)) {
      return configSettingsResult;
    }

    const configSettings = configSettingsResult as Array<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>>;
    const configurationChanges: Array<ConfigurationSettingChange> = [];

    // Build O(1) lookup structures keyed by "key\0label" composite.
    const srcMap = new Map<string, SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>>();
    const toAddKeys = new Set<string>();
    for (const config of configSettings) {
      const composite = getSettingIdentity(config.key, config.label);
      srcMap.set(composite, config);
      toAddKeys.add(composite);
    }

    // Stream target settings so we don't hold the entire remote store in memory.
    for await (const existing of this.configurationClient.listConfigurationSettings({
      ...configSettingsSource.FilterOptions,
      ...options
    })) {
      const composite = getSettingIdentity(existing.key, existing.label);
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

        if (!isConfigSettingEqual(incoming, existing, configSettingsSource.supportedFields)) {
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
    const deleteTaskManager = createAdaptiveTaskManager((setting) => this.configurationClient.deleteConfigurationSetting(setting, options), settingsToDelete);
    const startTime = Date.now();
    await executeTasksWithTimeout(deleteTaskManager, timeout);
    const endTime = Date.now();
    const deleteTimeConsumed = (endTime - startTime) / 1000;
    timeout -= deleteTimeConsumed;

    const importTaskManager = createAdaptiveTaskManager((setting) => this.configurationClient.setConfigurationSetting(setting, options), settingsToPut);
    await executeTasksWithTimeout(importTaskManager, timeout, progressCallback);
  }
}
