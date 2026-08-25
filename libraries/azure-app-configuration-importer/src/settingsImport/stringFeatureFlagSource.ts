// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  FeatureFlagParam,
  FeatureFlagValue,
  featureFlagContentType,
  featureFlagPrefix,
  ListFeatureFlagsOptions,
  SecretReferenceValue,
  SetConfigurationSettingParam
} from "@azure/app-configuration";
import { ConfigurationProfile } from "../enums";
import { ArgumentError } from "../errors";
import { FfSetConfigurationSettingsConverter } from "../internal/parsers/ffSetConfigurationSettingsConverter";
import { DefaultConfigurationSettingsConverter } from "../internal/parsers/defaultConfigurationSettingsConverter";
import { detectConfigurationProfile, parseStringData } from "../internal/stringSourceUtils";
import { validateOptions } from "../internal/utils";
import { SourceOptions, StringSourceOptions } from "../options";
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

    const featureFlags = new DefaultConfigurationSettingsConverter().Convert(loadedData, this.options)
      .filter(setting => setting.contentType === featureFlagContentType && setting.value !== undefined)
      .map(setting => this.toEnhancedFeatureFlag(setting));

    return new FfSetConfigurationSettingsConverter().Convert({ items: featureFlags });
  }

  private toEnhancedFeatureFlag(
    setting: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>
  ): FeatureFlagParam {
    const value = JSON.parse(setting.value as string) as Record<string, any>;
    const featureFlag: FeatureFlagParam = {
      name: setting.key.startsWith(featureFlagPrefix) ? setting.key.substring(featureFlagPrefix.length) : setting.key,
      enabled: value.enabled
    };

    if (setting.label !== undefined) {
      featureFlag.label = setting.label;
    }
    if (value.description !== undefined) {
      featureFlag.description = value.description;
    }
    if (value.conditions) {
      featureFlag.conditions = {
        requirementType: value.conditions.requirement_type,
        filters: value.conditions.client_filters
      };
    }
    if (value.variants) {
      featureFlag.variants = value.variants.map((variant: Record<string, any>) => {
        const variantValue = variant.configuration_value;
        const enhancedVariant: NonNullable<FeatureFlagParam["variants"]>[number] = {
          name: variant.name
        };
        if (variantValue !== undefined) {
          enhancedVariant.value = typeof variantValue === "string" ? variantValue : JSON.stringify(variantValue);
          if (typeof variantValue !== "string") {
            enhancedVariant.contentType = "application/json";
          }
        }
        if (variant.status_override !== undefined) {
          enhancedVariant.statusOverride = variant.status_override;
        }
        return enhancedVariant;
      });
    }
    if (value.allocation) {
      featureFlag.allocation = {};
      if (value.allocation.user !== undefined) featureFlag.allocation.user = value.allocation.user;
      if (value.allocation.group !== undefined) featureFlag.allocation.group = value.allocation.group;
      if (value.allocation.percentile !== undefined) featureFlag.allocation.percentile = value.allocation.percentile;
      if (value.allocation.seed !== undefined) featureFlag.allocation.seed = value.allocation.seed;
      if (value.allocation.default_when_enabled !== undefined) featureFlag.allocation.defaultWhenEnabled = value.allocation.default_when_enabled;
      if (value.allocation.default_when_disabled !== undefined) featureFlag.allocation.defaultWhenDisabled = value.allocation.default_when_disabled;
    }
    if (value.telemetry !== undefined) {
      featureFlag.telemetry = value.telemetry;
    }
    if (setting.tags !== undefined) {
      featureFlag.tags = setting.tags;
    }
    return featureFlag;
  }
}