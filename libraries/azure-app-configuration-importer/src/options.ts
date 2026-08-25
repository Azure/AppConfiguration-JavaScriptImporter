// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { PagedAsyncIterableIterator, PageSettings } from "@azure/core-paging";
import { ConfigurationFormat, ConfigurationProfile, ImportMode } from "./enums";
import { Tags, ImportProgress } from "./models";
import { ConfigurationSetting, FeatureFlag, ListConfigurationSettingPage, ListFeatureFlagPage } from "@azure/app-configuration";

type Options = {
  label?: string;
  skipFeatureFlags?: boolean;
  prefix?: string;
  contentType?: string;
  tags?: Tags;
}

/**
 * Base options for configuration import
 *
 * @internal
 */
export type SourceOptions = {
  format: ConfigurationFormat;
  separator?: string;
  depth?: number;
  profile?: ConfigurationProfile;
} & Options;

/**
 * Provides options for importing from string data source
 *
 */
export type StringSourceOptions = SourceOptions & {data: string; };
export type IterableSourceOptions = Options & { data: PagedAsyncIterableIterator<ConfigurationSetting<string>, ListConfigurationSettingPage, PageSettings>;  trimPrefix?: string; };
export type IterableFeatureFlagSourceOptions = {
  data: PagedAsyncIterableIterator<FeatureFlag, ListFeatureFlagPage, PageSettings>;
  prefix?: string;
  trimPrefix?: string;
  label?: string;
};
export type ReadableStreamSourceOptions = SourceOptions & { data: ReadableStream<Uint8Array> | NodeJS.ReadableStream };

/**
 * Options for importing configuration settings
 */
export interface ImportOptions {
  /**
   * Seconds of entire import progress timeout.
   */
  timeout: number;
  /**
   * Callback to report the progress of import.
   */
  progressCallback?: (progress: ImportProgress) => unknown;
  /**
   * Use strict mode to delete settings not in source.
   */
  strict?: boolean;
  /**
   * Determines the behavior when importing key-values. 
   * The default value, 'All' will import all key-values in the input file to App Configuration. 
   * 'Ignore-Match' will only import settings that have no matching key-value in App Configuration.
   */
  importMode?: ImportMode;
}

/** Options for importing enhanced feature flags. */
export type FeatureFlagImportOptions = ImportOptions;