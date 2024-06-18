// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  FeatureFlagValue,
  ListConfigurationSettingsOptions,
  SecretReferenceValue,
  SetConfigurationSettingParam
} from "@azure/app-configuration";

/**
 * Interface of all ConfigurationSettingsSource
 */
export interface ConfigurationSettingsSource {
  /**
   * Get ConfigurationSettings collection from source.
   *
   * @returns Collection of ConfigurationSettings
   */
  GetConfigurationSettings(): Promise<Array<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>>>;

  /**
   * Get label and prefix filter
   *
   * @returns label and prefix
   */
   FilterOptions: ListConfigurationSettingsOptions;
}
