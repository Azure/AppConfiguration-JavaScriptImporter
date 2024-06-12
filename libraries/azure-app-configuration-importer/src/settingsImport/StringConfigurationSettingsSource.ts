// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  FeatureFlagValue,
  ListConfigurationSettingsOptions,
  SecretReferenceValue,
  SetConfigurationSettingParam
} from "@azure/app-configuration";
import * as jsyaml from "js-yaml";
import stripJSONComments from "strip-json-comments";
import { getProperties  } from "properties-file";
import { SourceOptions, StringSourceOptions } from "../importOptions";
import { ConfigurationSettingsSource } from "./ConfigurationSettingsSource";
import { ConfigurationFormat, ConfigurationProfile } from "../enums";
import { ArgumentError, ParseError } from "../errors";
import { validateOptions } from "../internal/utils";
import { ConfigurationSettingsConverter } from "../internal/parsers/ConfigurationSettingsConverter";
import { DefaultConfigurationSettingsConverter } from "../internal/parsers/DefaultConfigurationSettingsConverter";
import { KvSetConfigurationSettingsConverter } from "../internal/parsers/KvSetConfigurationSettingsConverter";

/**
 * ConfigurationSettingsSource implementation of  string data configuration source
 */
export class StringConfigurationSettingsSource implements ConfigurationSettingsSource {
  public FilterOptions: ListConfigurationSettingsOptions = {};
  private options: SourceOptions;
  private data: string;

  constructor(options: StringSourceOptions) {
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

  /**
   * @inheritdoc
   */
  public async GetConfigurationSettings(): Promise<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[]> {
    return this.getConfigurationSettingsInternal(this.data);
  }

  /**
   * Get the ConfigurationSettings from supplied data string source.
   * 
   * @param data The string data being parsed.
   * @returns Collection of ConfigurationSettings
   */
  protected getConfigurationSettingsInternal(data: string): Array<
    SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>
  > {
    let loadedData: any = {};
    // Checking string encoding format
    if (/^\uFEFF/.test(data)) {
      throw new ParseError(
        "Failed to parse data: An invalid encoding, UTF-8 with BOM, was detected. Please update encoding to UTF-8 without BOM."
      );
    }

    try {
      switch (this.options.format) {
        case ConfigurationFormat.Json: {
          loadedData = JSON.parse(stripJSONComments(data));
          break;
        }
        case ConfigurationFormat.Yaml: {
          const temp = jsyaml.load(data, { schema: jsyaml.JSON_SCHEMA });
          if (temp === undefined) {
            throw new ParseError(
              "Failed to parse data: Not a valid yaml format."
            );
          }
          else {
            loadedData = temp;
          }
          break;
        }
        case ConfigurationFormat.Properties: {
          loadedData = getProperties(data);
          break;
        }
        default: {
          throw new ArgumentError("Data Format provided is not supported. Supported values are: Json, Yaml and Properties.");
        }
      }
    }
    catch (e: any) {
      throw new ParseError(`Failed to parse data: ${e.message}`);
    }

    if (typeof loadedData !== "object") {
      throw new ParseError(
        `Type of data be parsed is ${typeof loadedData}, not a valid object type`
      );
    }

    let converter: ConfigurationSettingsConverter;
    if (this.options.profile === ConfigurationProfile.KvSet) {
      converter = new KvSetConfigurationSettingsConverter();
    }
    else {
      converter = new DefaultConfigurationSettingsConverter();
    }

    return converter.Convert(loadedData, this.options);
  }
}