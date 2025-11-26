// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ConfigurationSettingsSource } from "./configurationSettingsSource";
import { ConfigurationChanges } from "../models";
import { ListConfigurationSettingsOptions } from "@azure/app-configuration";
import { ArgumentError } from "../errors";

export class ConfigurationChangesSource implements ConfigurationSettingsSource {
  private readonly configurationChanges: ConfigurationChanges;

  constructor(configurationChanges: ConfigurationChanges, filterOptions?: ListConfigurationSettingsOptions) {
    if (filterOptions && Object.keys(filterOptions).length > 0) {
      throw new ArgumentError("FilterOptions are not supported for ConfigurationChangesSource.");
    }
    this.configurationChanges = configurationChanges;
  }

  /**
     * @inheritdoc
     */
  public async GetConfigurationSettings(): Promise<ConfigurationChanges> {
    return this.configurationChanges;
  }
}