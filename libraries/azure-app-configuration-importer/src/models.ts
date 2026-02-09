// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { 
  SecretReferenceValue,
  ConfigurationSetting,
  SetConfigurationSettingParam,
  FeatureFlagValue
} from "@azure/app-configuration";

/**
 * @internal
 */
export type ClientFilter = { name: string; parameters?: Record<string, unknown> };

/**
 * @internal
 */
export interface JsonSecretReferenceValue {
  uri: string;
}

/**
 * @internal
 */
export type KvSetConfigurationItem = {
  key: string;
  value?: string;
  label?: string;
  content_type?: string;
  tags?: { [propertyName: string]: string };
}

export interface ImportProgress {
  successCount: number;
  importCount: number;
}

export interface Tags {
  [propertyName: string]: string;
}

export interface FeatureFlagClientFilters {
  name: string;
  parameters?: Record<string, unknown> | undefined;
}

export interface KeyLabelLookup {
  [key: string]: {
    [label: string] : boolean
  }
}

/**
 * Represents a modified configuration setting with both incoming and existing values for diff display.
 */
export interface ModifiedSetting {
  /** The new configuration setting from the source that will be imported */
  incoming: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>;
  /** The existing configuration setting currently in the App Configuration store */
  existing: ConfigurationSetting<string>;
}

export interface ConfigurationChanges {
  ToDelete: ConfigurationSetting<string>[];
  ToModify: ModifiedSetting[];
  ToAdd: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[];
  ToRefresh: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[];
}