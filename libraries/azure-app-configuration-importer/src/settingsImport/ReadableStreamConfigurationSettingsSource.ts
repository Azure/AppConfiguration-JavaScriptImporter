// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { SetConfigurationSettingParam, FeatureFlagValue, SecretReferenceValue, ListConfigurationSettingsOptions } from "@azure/app-configuration";
import { toWebStream } from "../internal/stream";
import { ReadableStreamSourceOptions, SourceOptions } from "../importOptions";
import { ConfigurationSettingsSource } from "./ConfigurationSettingsSource";
import { ConfigurationProfile } from "../enums";
import { StringConfigurationSettingsSource } from "./StringConfigurationSettingsSource";
import { validateOptions} from "../internal/utils";

export class ReadableStreamConfigurationSettingsSource implements ConfigurationSettingsSource { 
  public FilterOptions: ListConfigurationSettingsOptions = {};
  private options: SourceOptions;
  private data: ReadableStream<Uint8Array> | NodeJS.ReadableStream;

  constructor(options: ReadableStreamSourceOptions) {
    validateOptions(options);
    this.options = options;
    this.data = options.data;

    if (options.profile == ConfigurationProfile.Default) {
      this.FilterOptions = {
        keyFilter: options.prefix ? options.prefix + "*" : undefined,
        labelFilter: options.label ? options.label : "\0"
      };
    }
    else if (options.profile == ConfigurationProfile.KvSet) {
      this.FilterOptions = {
        keyFilter: "*",
        labelFilter: "*"
      };
    }
  }

  public async GetConfigurationSettings(): Promise<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[]> {
    const reader: ReadableStreamDefaultReader = toWebStream(this.data).getReader();
    const textDecoder = new TextDecoder("utf-8");

    try {
      let allData = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const stringSource = new StringConfigurationSettingsSource({...this.options, data: allData});
          const settings = await stringSource.GetConfigurationSettings();

          return settings;
        }

        if (value) {
          allData += textDecoder.decode(value);
        }
      }
    }
    finally{
      reader.releaseLock();
    }
  }
}