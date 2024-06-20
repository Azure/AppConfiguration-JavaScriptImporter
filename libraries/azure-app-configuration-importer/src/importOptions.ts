// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { PagedAsyncIterableIterator, PageSettings } from "@azure/core-paging";
import { ConfigurationFormat, ConfigurationProfile } from "./enums";
import { Tags } from "./models";
import { ConfigurationSetting, ListConfigurationSettingPage } from "@azure/app-configuration";

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
export type ReadableStreamSourceOptions = SourceOptions & { data: ReadableStream<Uint8Array> | NodeJS.ReadableStream };