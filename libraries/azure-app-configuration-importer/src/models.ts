// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

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
export type JsonFeatureFlagValue = {
  conditions: {
    client_filters: { name: string; parameters?: Record<string, unknown> }[];
  };
  description?: string;
  enabled: boolean;
  id?: string;
  display_name?: string;
  allocation?: {
    user?: { variant: string; users: string[] }[];
    group?: { variant: string; groups: string[] }[];
    default_when_enabled?: string;
    default_when_disabled?: string;
    percentile?: { variant: string; from: number; to: number }[];
    seed?: string;
  };
  variants?: { name: string; configuration_value?: string | number | object | boolean; status_override?: string }[];
  telemetry?: { enabled?: boolean; metadata?: object };
};

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