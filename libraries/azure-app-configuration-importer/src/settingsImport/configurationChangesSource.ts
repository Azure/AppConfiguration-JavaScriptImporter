// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ConfigurationSettingsSource } from "./configurationSettingsSource";
import { ConfigurationSettingChange, ConfigurationSettingsFields } from "../models";
import { ListConfigurationSettingsOptions } from "@azure/app-configuration";
import { ArgumentError } from "../errors";

/**
 * A ConfigurationSettingsSource that wraps pre-calculated configuration changes.
 * 
 * Use this class to import changes that were previously obtained via GetConfigurationChanges().
 * 
 * Example usage:
 * ```ts
 * // First, get the configuration changes
 * const changes = await importer.GetConfigurationChanges(source);
 * 
 * // Import the pre-calculated changes
 * const changesSource = new ConfigurationChangesSource(changes);
 * await importer.Import(changesSource, { timeout: 60 });
 * ```
 */
export class ConfigurationChangesSource implements ConfigurationSettingsSource {
  public supportedFields: Array<ConfigurationSettingsFields>;
  private readonly configurationChanges: Array<ConfigurationSettingChange>;
  
  constructor(configurationChanges: Array<ConfigurationSettingChange>, supportedFields?: Array<ConfigurationSettingsFields>, filterOptions?: ListConfigurationSettingsOptions) {
    if (filterOptions && Object.keys(filterOptions).length > 0) {
      throw new ArgumentError("FilterOptions are not supported for ConfigurationChangesSource.");
    }
    this.configurationChanges = configurationChanges;
    this.supportedFields = supportedFields ?? [ConfigurationSettingsFields.All];
  }

  /**
     * @inheritdoc
     */
  public async GetConfigurationSettings(): Promise<Array<ConfigurationSettingChange>> {
    return this.configurationChanges;
  }
}