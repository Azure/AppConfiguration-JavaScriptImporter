// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  FeatureFlagParam,
  FeatureFlagValue,
  featureFlagContentType,
  featureFlagPrefix,
  ListConfigurationSettingsOptions,
  ListFeatureFlagsOptions,
  SecretReferenceValue,
  SetConfigurationSettingParam
} from "@azure/app-configuration";
import * as jsyaml from "js-yaml";
import stripJSONComments from "strip-json-comments";
import { getProperties  } from "properties-file";
import { SourceOptions, StringSourceOptions } from "../options";
import { ConfigurationSettingsSource } from "./configurationSettingsSource";
import { ConfigurationFormat, ConfigurationProfile } from "../enums";
import { ArgumentError, ParseError } from "../errors";
import { validateOptions } from "../internal/utils";
import { ConfigurationSettingsConverter } from "../internal/parsers/configurationSettingsConverter";
import { DefaultConfigurationSettingsConverter } from "../internal/parsers/defaultConfigurationSettingsConverter";
import { KvSetConfigurationSettingsConverter } from "../internal/parsers/kvSetConfigurationSettingsConverter";
import { ConfigurationSettingsFields } from "../models";
import { FfSetConfigurationSettingsConverter } from "../internal/parsers/ffSetConfigurationSettingsConverter";
import { FeatureFlagSource } from "./featureFlagSource";

/**
 * ConfigurationSettingsSource implementation of  string data configuration source
 */
export class StringConfigurationSettingsSource implements ConfigurationSettingsSource, FeatureFlagSource {
  public FilterOptions: ListConfigurationSettingsOptions = {};
  public supportedFields: ConfigurationSettingsFields = ConfigurationSettingsFields.All;
  public FeatureFlagFilterOptions: ListFeatureFlagsOptions = {};
  private options: SourceOptions;
  private data: string;
  private depthWasSpecified: boolean;

  constructor(options: StringSourceOptions) {
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

  public async GetFeatureFlags(): Promise<FeatureFlagParam[]> {
    return this.getFeatureFlagsInternal(this.data);
  }

  protected getFeatureFlagsInternal(data: string): FeatureFlagParam[] {
    const loadedData = this.parseData(data);
    const detectedProfile = this.detectProfile(loadedData);
    if (detectedProfile === ConfigurationProfile.KvSet) {
      throw new ArgumentError("The appconfig/kvset profile is not supported by FeatureFlagImporter.");
    }

    validateOptions({
      ...this.options,
      depth: this.depthWasSpecified ? this.options.depth : undefined,
      profile: detectedProfile
    });
    this.setFeatureFlagFilterOptions(detectedProfile);

    if (detectedProfile === ConfigurationProfile.FfSet) {
      return new FfSetConfigurationSettingsConverter().Convert(loadedData);
    }

    const settings = new DefaultConfigurationSettingsConverter().Convert(loadedData, this.options);
    return settings
      .filter(setting => setting.contentType === featureFlagContentType && setting.value !== undefined)
      .map(setting => this.toFeatureFlag(setting));
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
    const loadedData = this.parseData(data);
    const detectedProfile = this.detectProfile(loadedData);
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

  private parseData(data: string): Record<string, any> {
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

    return loadedData;
  }

  private detectProfile(loadedData: Record<string, unknown>): ConfigurationProfile {
    let detectedProfile = ConfigurationProfile.Default;

    if (Object.prototype.hasOwnProperty.call(loadedData, "profile")) {
      const profile = loadedData.profile;
      if (typeof profile !== "string" || profile.trim().length === 0) {
        throw new ArgumentError("The document profile must be a non-empty string.");
      }

      if (profile === "appconfig/kvset") {
        detectedProfile = ConfigurationProfile.KvSet;
      }
      else if (profile === "appconfig/ffset") {
        detectedProfile = ConfigurationProfile.FfSet;
      }
      else {
        throw new ArgumentError(`The document profile '${profile}' is not supported.`);
      }

      delete loadedData.profile;
    }

    if (this.options.profile !== undefined && this.options.profile !== detectedProfile) {
      throw new ArgumentError("The source profile option does not match the document profile.");
    }

    return detectedProfile;
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

  private setFeatureFlagFilterOptions(profile: ConfigurationProfile): void {
    this.FeatureFlagFilterOptions = profile === ConfigurationProfile.FfSet
      ? { nameFilter: "*", labelFilter: "*" }
      : {
        nameFilter: this.options.prefix ? this.options.prefix + "*" : undefined,
        labelFilter: this.options.label ? this.options.label : "\0"
      };
  }

  private toFeatureFlag(
    setting: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>
  ): FeatureFlagParam {
    const value = JSON.parse(setting.value as string) as Record<string, any>;
    return {
      name: setting.key.startsWith(featureFlagPrefix) ? setting.key.substring(featureFlagPrefix.length) : setting.key,
      label: setting.label,
      enabled: value.enabled,
      description: value.description,
      conditions: value.conditions ? {
        requirementType: value.conditions.requirement_type,
        filters: value.conditions.client_filters
      } : undefined,
      variants: value.variants?.map((variant: Record<string, any>) => {
        const variantValue = variant.configuration_value;
        return {
          name: variant.name,
          value: typeof variantValue === "string" ? variantValue : JSON.stringify(variantValue),
          contentType: typeof variantValue === "string" ? undefined : "application/json",
          statusOverride: variant.status_override
        };
      }),
      allocation: value.allocation ? {
        user: value.allocation.user,
        group: value.allocation.group,
        percentile: value.allocation.percentile,
        seed: value.allocation.seed,
        defaultWhenEnabled: value.allocation.default_when_enabled,
        defaultWhenDisabled: value.allocation.default_when_disabled
      } : undefined,
      telemetry: value.telemetry,
      tags: setting.tags
    };
  }
}