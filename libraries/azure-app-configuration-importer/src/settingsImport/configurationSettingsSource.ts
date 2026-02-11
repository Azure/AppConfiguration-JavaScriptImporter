// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  FeatureFlagValue,
  ListConfigurationSettingsOptions,
  SecretReferenceValue,
  SetConfigurationSettingParam
} from "@azure/app-configuration";
import { ConfigurationSettingChange } from "../models";

/**
 * Interface of all ConfigurationSettingsSource
 */
export interface ConfigurationSettingsSource {
  /**
   * Get ConfigurationSettings collection from source.
   *
   * @returns Collection of ConfigurationSettings or ConfigurationSettingChanges
   */
  GetConfigurationSettings(): Promise<Array<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>> | Array<ConfigurationSettingChange>>;

  /**
   * Get label and prefix filter
   *
   * @returns label and prefix
   */
   FilterOptions?: ListConfigurationSettingsOptions;
}
