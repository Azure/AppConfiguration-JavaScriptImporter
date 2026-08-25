// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  FeatureFlagParam,
  ListFeatureFlagsOptions
} from "@azure/app-configuration";
import { ConfigurationProfile } from "../../enums";
import { ArgumentError } from "../../errors";
import { FfSetConfigurationSettingsConverter } from "../../internal/parsers/ffSetConfigurationSettingsConverter";
import { DefaultFeatureFlagsConverter } from "../../internal/parsers/defaultFeatureFlagsConverter";
import { detectConfigurationProfile, parseStringData } from "../../internal/stringSourceUtils";
import { validateOptions } from "../../internal/utils";
import { SourceOptions, StringSourceOptions } from "../../options";
import { FeatureFlagSource } from "./featureFlagSource";

/**
 * A FeatureFlagSource that reads enhanced feature flags from serialized string data.
 */
export class StringFeatureFlagSource implements FeatureFlagSource {
  public FeatureFlagFilterOptions: ListFeatureFlagsOptions = {};
  private options: SourceOptions;
  private data: string;
  private depthWasSpecified: boolean;

  /**
   * Initializes a feature flag source backed by serialized string data.
   *
   * @param options - String data, format, profile, and transformation options.
   */
  public constructor(options: StringSourceOptions) {
    if (options.profile === ConfigurationProfile.KvSet) {
      throw new ArgumentError("The appconfig/kvset profile is not supported by StringFeatureFlagSource.");
    }
    this.depthWasSpecified = options.depth !== undefined;
    validateOptions(options);
    this.options = options;
    this.data = options.data;
  }

  /**
   * @inheritdoc
   */
  public async GetFeatureFlags(): Promise<FeatureFlagParam[]> {
    const loadedData = parseStringData(this.data, this.options.format);
    const detectedProfile = detectConfigurationProfile(loadedData, this.options.profile);
    if (detectedProfile === ConfigurationProfile.KvSet) {
      throw new ArgumentError("The appconfig/kvset profile is not supported by StringFeatureFlagSource.");
    }

    validateOptions({
      ...this.options,
      depth: this.depthWasSpecified ? this.options.depth : undefined,
      profile: detectedProfile
    });
    this.FeatureFlagFilterOptions = detectedProfile === ConfigurationProfile.FfSet
      ? { nameFilter: "*", labelFilter: "*" }
      : {
        nameFilter: this.options.prefix ? this.options.prefix + "*" : undefined,
        labelFilter: this.options.label ? this.options.label : "\0"
      };

    if (detectedProfile === ConfigurationProfile.FfSet) {
      return new FfSetConfigurationSettingsConverter().Convert(loadedData);
    }

    return new DefaultFeatureFlagsConverter().Convert(loadedData, this.options);
  }
}