// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { 
  SecretReferenceValue,
  ConfigurationSetting,
  SetConfigurationSettingParam,
  FeatureFlagValue
} from "@azure/app-configuration";
import { ChangeType } from "./enums";

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
  description?: string;
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

export interface ConfigurationSettingChange {
  changeType: ChangeType;
  /** The current value of the configuration setting */
  currentValue: ConfigurationSetting<string> | null;
  /** The new value of the configuration setting */
  newValue: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue> | null;
}

export enum ConfigurationSettingsFields {
  None = 0,
  Key = 1 << 0,
  Value = 1 << 1,
  Label = 1 << 2,
  Description = 1 << 3,
  ContentType = 1 << 4,
  Tags = 1 << 5,

  All = Key | Value | Label | Description | ContentType | Tags
}