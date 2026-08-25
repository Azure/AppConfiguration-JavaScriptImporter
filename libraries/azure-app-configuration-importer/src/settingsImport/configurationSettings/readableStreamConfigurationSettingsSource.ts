// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { SetConfigurationSettingParam, FeatureFlagValue, SecretReferenceValue, ListConfigurationSettingsOptions } from "@azure/app-configuration";
import { toWebStream } from "../../internal/stream";
import { ReadableStreamSourceOptions, SourceOptions } from "../../options";
import { ConfigurationSettingsSource } from "./configurationSettingsSource";
import { ConfigurationProfile } from "../../enums";
import { StringConfigurationSettingsSource } from "./stringConfigurationSettingsSource";
import { validateOptions} from "../../internal/utils";
import { ConfigurationSettingsFields } from "../../models";

export class ReadableStreamConfigurationSettingsSource implements ConfigurationSettingsSource {
  public FilterOptions: ListConfigurationSettingsOptions = {};
  public supportedFields = ConfigurationSettingsFields.All;
  private options: SourceOptions;
  private data: ReadableStream<Uint8Array> | NodeJS.ReadableStream;
  private depthWasSpecified: boolean;

  constructor(options: ReadableStreamSourceOptions) {
    this.depthWasSpecified = options && options.depth !== undefined;
    validateOptions(options);
    this.options = options;
    this.data = options.data;

    if (options.profile == ConfigurationProfile.Default) {
      this.FilterOptions = {
        keyFilter: options.prefix ? options.prefix + "*" : undefined,
        labelFilter: options.label ? options.label : "\0"
      };
      this.supportedFields = ConfigurationSettingsFields.Key | ConfigurationSettingsFields.Label | ConfigurationSettingsFields.Value | ConfigurationSettingsFields.ContentType | ConfigurationSettingsFields.Tags;
    }
    else if (options.profile == ConfigurationProfile.KvSet) {
      this.FilterOptions = {
        keyFilter: "*",
        labelFilter: "*"
      };
      this.supportedFields = ConfigurationSettingsFields.All;
    }
  }

  public async GetConfigurationSettings(): Promise<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[]> {
    const stringSource = this.createStringSource(await this.readAllData());
    const settings = await stringSource.GetConfigurationSettings();
    this.FilterOptions = stringSource.FilterOptions;
    return settings;
  }

  private async readAllData(): Promise<string> {
    const reader: ReadableStreamDefaultReader = toWebStream(this.data).getReader();
    const textDecoder = new TextDecoder("utf-8");

    try {
      let allData = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          return allData;
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

  private createStringSource(data: string): StringConfigurationSettingsSource {
    return new StringConfigurationSettingsSource({
      ...this.options,
      depth: this.depthWasSpecified ? this.options.depth : undefined,
      data
    });
  }
}