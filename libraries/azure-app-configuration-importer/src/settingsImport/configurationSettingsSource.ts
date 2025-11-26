// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  FeatureFlagValue,
  ListConfigurationSettingsOptions,
  SecretReferenceValue,
  SetConfigurationSettingParam
} from "@azure/app-configuration";
import { ConfigurationChanges } from "../models";

/**
 * Interface of all ConfigurationSettingsSource
 */
export interface ConfigurationSettingsSource {
  /**
   * Get ConfigurationSettings collection from source.
   *
   * @returns Collection of ConfigurationSettings or ConfigurationChanges
   */
  GetConfigurationSettings(): Promise<Array<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>> | ConfigurationChanges>;

  /**
   * Get label and prefix filter
   *
   * @returns label and prefix
   */
   FilterOptions?: ListConfigurationSettingsOptions;
}
