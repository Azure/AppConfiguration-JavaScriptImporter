// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * Enums of configuration Format.
 */
export enum ConfigurationFormat {
  Json,
  Properties,
  Yaml,
}

/**
 * Enums of configuration Profile.
 */
export enum ConfigurationProfile {
  Default,
  KvSet,
  FfSet,
}

/**
 * Enums of import mode.
 */
export enum ImportMode {
  All,
  IgnoreMatch
}

/**
 * Enums of change type for configuration settings changes
 */
export enum ChangeType {
  None,
  Create,
  Delete,
  Update
}