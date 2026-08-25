// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  FeatureFlagValue,
  ListConfigurationSettingsOptions,
  SecretReferenceValue,
  SetConfigurationSettingParam
} from "@azure/app-configuration";
import { SourceOptions, StringSourceOptions } from "../../options";
import { ConfigurationSettingsSource } from "./configurationSettingsSource";
import { ConfigurationProfile } from "../../enums";
import { ArgumentError } from "../../errors";
import { validateOptions } from "../../internal/utils";
import { detectConfigurationProfile, parseStringData } from "../../internal/stringSourceUtils";
import { ConfigurationSettingsConverter } from "../../internal/parsers/configurationSettingsConverter";
import { DefaultConfigurationSettingsConverter } from "../../internal/parsers/defaultConfigurationSettingsConverter";
import { KvSetConfigurationSettingsConverter } from "../../internal/parsers/kvSetConfigurationSettingsConverter";
import { ConfigurationSettingsFields } from "../../models";

/**
 * ConfigurationSettingsSource implementation of  string data configuration source
 */
export class StringConfigurationSettingsSource implements ConfigurationSettingsSource {
  public FilterOptions: ListConfigurationSettingsOptions = {};
  public supportedFields: ConfigurationSettingsFields = ConfigurationSettingsFields.All;
  private options: SourceOptions;
  private data: string;
  private depthWasSpecified: boolean;

  constructor(options: StringSourceOptions) {
    if (options.profile === ConfigurationProfile.FfSet) {
      throw new ArgumentError("The appconfig/ffset profile is not supported by StringConfigurationSettingsSource.");
    }
    this.depthWasSpecified = options && options.depth !== undefined;
    validateOptions(options);
    this.options = options;
    this.data = options.data;

    if (options.profile == ConfigurationProfile.Default) {
      this.FilterOptions = {
        keyFilter: options.prefix ? options.prefix + "*" : undefined,
        labelFilter: options.label ? options.label : "\0"
      };

      this.supportedFields = ConfigurationSettingsFields.Key | ConfigurationSettingsFields.Label | ConfigurationSettingsFields.Value | ConfigurationSettingsFields.ContentType| ConfigurationSettingsFields.Tags;
    }
    else if (options.profile == ConfigurationProfile.KvSet) {
      this.FilterOptions = {
        keyFilter: "*",
        labelFilter: "*"
      };
      this.supportedFields = ConfigurationSettingsFields.All;
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
    const loadedData = parseStringData(data, this.options.format);
    const detectedProfile = detectConfigurationProfile(loadedData, this.options.profile);
    if (detectedProfile === ConfigurationProfile.FfSet) {
      throw new ArgumentError("The appconfig/ffset profile is not supported by AppConfigurationImporter.");
    }

    validateOptions({
      ...this.options,
      depth: this.depthWasSpecified ? this.options.depth : undefined,
      profile: detectedProfile
    });
    this.setFilterOptions(detectedProfile);

    let converter: ConfigurationSettingsConverter;
    if (detectedProfile === ConfigurationProfile.KvSet) {
      converter = new KvSetConfigurationSettingsConverter();
    }
    else {
      converter = new DefaultConfigurationSettingsConverter();
    }

    return converter.Convert(loadedData, this.options);
  }

  private setFilterOptions(profile: ConfigurationProfile): void {
    if (profile === ConfigurationProfile.KvSet) {
      this.FilterOptions = {
        keyFilter: "*",
        labelFilter: "*"
      };
    }
    else {
      this.FilterOptions = {
        keyFilter: this.options.prefix ? this.options.prefix + "*" : undefined,
        labelFilter: this.options.label ? this.options.label : "\0"
      };
    }
  }

}