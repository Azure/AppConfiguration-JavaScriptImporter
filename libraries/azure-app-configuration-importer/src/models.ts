// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { 
  SecretReferenceValue,
  ConfigurationSetting,
  SetConfigurationSettingParam,
  FeatureFlagValue,
  FeatureFlag,
  FeatureFlagParam
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

/**
 * Raw ffset feature flag item as authored in an appconfig/ffset file
 *
 * @internal
 */
export type FfSetItem = {
  name: string;
  label?: string | null;
  enabled?: boolean | null;
  description?: string | null;
  conditions?: {
    requirement_type?: string;
    filters?: Array<{ name: string; parameters?: Record<string, string | null> | null }> | null;
  } | null;
  variants?: Array<{ name: string; value?: string | null; content_type?: string | null; status_override?: string }> | null;
  allocation?: {
    user?: Array<{ variant: string; users: string[] }> | null;
    group?: Array<{ variant: string; groups: string[] }> | null;
    percentile?: Array<{ variant: string; from: number; to: number }> | null;
    seed?: string | null;
    default_when_enabled?: string | null;
    default_when_disabled?: string | null;
  } | null;
  telemetry?: { enabled?: boolean | null; metadata?: Record<string, string | null> | null } | null;
  tags?: Record<string, string> | null;
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

export interface FeatureFlagChange {
  changeType: ChangeType;
  /** The current enhanced feature flag. */
  currentValue: FeatureFlag | null;
  /** The new enhanced feature flag. */
  newValue: FeatureFlagParam | null;
}