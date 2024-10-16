// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  SetConfigurationSettingParam,
  SecretReferenceValue,
  featureFlagPrefix,
  featureFlagContentType
} from "@azure/app-configuration";
import { SourceOptions } from "../../importOptions";
import { ConfigurationSettingsConverter } from "./configurationSettingsConverter";
import { ArgumentError } from "../../errors";
import { ClientFilter } from "../../models";
import * as flat from "flat";
import { ConfigurationFormat } from "../../enums";
import { isJsonContentType } from "../utils";
import { AllKeyWordCases, FeatureFlagKeywords, FeatureFlagValue, Group, Percentile, RequirementType, StatusOverride, User, Variant } from "../../featureFlag";

/**
 * Format Parser for common key-value configuration.
 *
 * @internal
 * */
export class DefaultConfigurationSettingsConverter implements ConfigurationSettingsConverter {
  /**
   * Parse the raw configuration object to collection of ConfigurationSettings
   *
   * @param config Raw configuration object
   * @param options Configuration options to dictate how the configuration be parsed.
   * */
  public Convert(
    config: object,
    options: SourceOptions
  ): SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[] {
    let configurationSettings = new Array<
      SetConfigurationSettingParam<string | FeatureFlagValue>
    >();
    let featureFlagsConfigSettings = new Array<SetConfigurationSettingParam<FeatureFlagValue>>();
    let foundFeatureManagement = false;
    let featureFlags: any = {};
    let featureManagementKeyWord = "";
    let featureFlagKeywordsCase: FeatureFlagKeywords = AllKeyWordCases[0];

    if (options.format == ConfigurationFormat.Properties && !options.skipFeatureFlags) {
      this.checkFeatureManagementExist(config);
    }

    for (let i = 0; i < AllKeyWordCases.length; i++) {
      if (AllKeyWordCases[i].feature_management in config) {
        if (foundFeatureManagement) {
          throw new ArgumentError(
            "Unable to proceed because data contains multiple sections corresponding to Feature Management."
          );
        }

        featureManagementKeyWord = AllKeyWordCases[i].feature_management;
        featureFlagKeywordsCase = AllKeyWordCases[i];
        const featureManagementKey = featureManagementKeyWord as keyof object;
        featureFlags = config[featureManagementKey];
        delete config[featureManagementKey];
        foundFeatureManagement = true;
      }
    }

    if (foundFeatureManagement && !options.skipFeatureFlags) {
      const featureFlagConverter = new FeatureFlagConfigurationSettingsConverter(
        featureManagementKeyWord,
        featureFlagKeywordsCase
      );
      featureFlagsConfigSettings = featureFlagConverter.Convert(featureFlags, options);
    }

    const flattenedConfigurationSettings: object = flat.flatten(config, {
      delimiter: options.separator,
      maxDepth: options.depth,
      safe: isJsonContentType(options.contentType) // preserve array for json content type
    });
    configurationSettings = this.toConfigurationSettings(flattenedConfigurationSettings, options);
    configurationSettings = configurationSettings.concat(featureFlagsConfigSettings);

    return configurationSettings;
  }

  private checkFeatureManagementExist(configurations: object): void {
    const keys: string[] = Object.keys(configurations);
    for (const featureFlagKeyWord of AllKeyWordCases) {
      if (keys.find(key => key.startsWith(featureFlagKeyWord.feature_management))) {
        throw new ArgumentError("Importing feature flag in Properties format is not supported. Anything in the Properties format being imported will be treated as key value.");
      }
    }
  }

  private toConfigurationSettings(
    flatted: any,
    options: SourceOptions
  ): Array<SetConfigurationSettingParam<string>> {
    const result = new Array<SetConfigurationSettingParam>();
    const isJsonType = isJsonContentType(options.contentType);
    for (const element in flatted) {
      let generateKey: string = element;
      if (options.prefix) {
        generateKey = options.prefix + element;
      }

      if (generateKey === "." || generateKey === ".." || generateKey.indexOf("%") > -1) {
        throw new ArgumentError("Key cannot be a '.' or '..', or contain the '%' character.");
      }
      if (generateKey.startsWith(featureFlagPrefix)) {
        throw new ArgumentError("Key cannot start with the reserved prefix for feature flags.");
      }

      // Ignore key-value with empty array/object value when content-type is not json, instead of pushing a kv with an empty array/obj
      // For null value it will be treated as "null" string.
      if (!isJsonType && flatted[element] && typeof flatted[element] === "object" && Object.keys(flatted[element]).length == 0 ) {
        continue;
      }

      const setting: SetConfigurationSettingParam<string> = {
        label: options.label,
        tags: options.tags,
        key: generateKey,
        contentType: options.contentType,
        value:
          typeof flatted[element] === "object" || isJsonType
            ? JSON.stringify(flatted[element])
            : flatted[element].toString()
      };

      result.push(setting);
    }

    return result;
  }
}

/**
 * ConfigurationSettings converter for feature flag.
 *
 * @internal
 * */
class FeatureFlagConfigurationSettingsConverter implements ConfigurationSettingsConverter {
  featureManagementKeyWord: string;
  featureFlagsKeyWordsCase: FeatureFlagKeywords;
  constructor(featureManagementKeyWord: string, featureFlagsKeyWordCase: FeatureFlagKeywords) {
    this.featureManagementKeyWord = featureManagementKeyWord;
    this.featureFlagsKeyWordsCase = featureFlagsKeyWordCase;

    if (!this.featureManagementKeyWord) {
      throw new ArgumentError("No feature management was found");
    }
  }

  /**
   * @inheritdoc
   * */
  Convert(
    config: object,
    options: SourceOptions
  ): SetConfigurationSettingParam<FeatureFlagValue>[] {
    const settings = new Array<SetConfigurationSettingParam<FeatureFlagValue>>();

    if (this.checkIfUsingFFV2Schema(config)) {
      const featureFlagsKeyWord: string = this.featureFlagsKeyWordsCase.feature_flags;
      const featureManagementKey = featureFlagsKeyWord as keyof object;
      const featureFlags: any = config[featureManagementKey];
      
      if (!Array.isArray(featureFlags)) { 
        throw new ArgumentError(
          `Data contains feature flags in invalid format. The ${featureFlagsKeyWord} should have be an array.`
        );
      }

      for (const featureFlag of featureFlags) {
        const lowerCaseFeatureFlag = this.getLowerCaseProperties(featureFlag);
        if (!lowerCaseFeatureFlag.id) {
          throw new ArgumentError(
            `Data contains feature flags in invalid format. The ${featureFlag} should have an id property.`
          );
        }

        if (!this.validateFeatureName(lowerCaseFeatureFlag.id)) {
          throw new ArgumentError(
            `Feature flag ${featureFlag} contains invalid character,'%' and ':' are not allowed in feature name. Please provide valid feature id.`
          );
        }

        const prefix: string = options.prefix ?? "";
        settings.push({
          key: featureFlagPrefix + prefix + featureFlag.id,
          label: options.label,
          value: this.getFeatureFlagsFromV2Schema(lowerCaseFeatureFlag),
          contentType: featureFlagContentType,
          tags: options.tags
        });
      }
    }
    else {
      for (const featureFlag in config) {
        if (!this.validateFeatureName(featureFlag)) {
          throw new ArgumentError(
            `Feature flag ${featureFlag} contains invalid character,'%' and ':' are not allowed in feature name. Please provide valid feature name.`
          );
        }

        const prefix: string = options.prefix ?? "";
        settings.push({
          key: featureFlagPrefix + prefix + featureFlag,
          label: options.label,
          value: this.getFeatureFlagValueFromV1Schema(
            featureFlag,
            config,
            this.featureFlagsKeyWordsCase.enabled_for
          ),
          contentType: featureFlagContentType,
          tags: options.tags
        });
      }
    }

    return settings;
  }

  private validateFeatureName(featureName: string): boolean {
    if (featureName) {
      const valid = /^[^:%]*$/;
      return valid.test(featureName);
    }
    else {
      return false;
    }
  }

  private getFeatureFlagValueFromV1Schema(
    featureFlagName: any,
    featureData: any,
    enabledForKeyWord: string
  ): FeatureFlagValue {

    const featureFlagValue: FeatureFlagValue = {
      id: featureFlagName,
      description: "",
      enabled: false,
      conditions: {
        clientFilters: []
      }
    };

    if (typeof featureData[featureFlagName] == "object") {
      const filters = featureData[featureFlagName][enabledForKeyWord];
      if (!filters) {
        throw new ArgumentError(
          `Data contains feature flags in invalid format. Feature flag '${featureFlagName}' must contain '${enabledForKeyWord}' definition or have a true/false value.`
        );
      }

      if (filters.length != 0) {
        featureFlagValue.enabled = true;
        featureFlagValue.conditions.clientFilters = filters;
        featureFlagValue.conditions.clientFilters = this.validateClientFilters(featureFlagName, "ffv1", featureFlagValue.conditions.clientFilters);
      }

      const requirement_type = featureData[this.featureFlagsKeyWordsCase.requirement_type];
      if(requirement_type) {
        if (this.validateRequirementType(requirement_type, featureFlagName)) {
          featureFlagValue.conditions.requirement_type = requirement_type;
        }
      }
    }
    else if (typeof featureData[featureFlagName] == "boolean") {
      featureFlagValue.enabled = featureData[featureFlagName];
    }
    else {
      throw new ArgumentError(
        `Data contains feature flags in invalid format. The type of ${featureFlagName} should be either boolean or dictionary.`
      );
    }
    return featureFlagValue;
  }

  private getFeatureFlagsFromV2Schema(featureFlag: any): FeatureFlagValue {
    const featureFlagValue: FeatureFlagValue = {
      id: "",
      description: "",
      enabled: false,
      conditions: {
        clientFilters: []
      }
    };

    featureFlagValue.id = featureFlag.id;
    featureFlagValue.enabled = featureFlag.enabled.toLowerCase() == "true";
    featureFlagValue.description = featureFlag.description || "";
    if (featureFlag.telemetry) {
      featureFlagValue.telemetry = featureFlag.telemetry;
    }

    const clientFilters = featureFlag.conditions && featureFlag.conditions[this.featureFlagsKeyWordsCase.client_filters];
    if (clientFilters && clientFilters.length != 0) {
      featureFlagValue.conditions.clientFilters = this.validateClientFilters(featureFlagValue.id, "ffv2", clientFilters);
    }

    const requirementType = featureFlag.conditions && featureFlag.conditions[this.featureFlagsKeyWordsCase.requirement_type];
    if (requirementType) {
      if (this.validateRequirementType(requirementType, featureFlag.id)) {
        featureFlagValue.conditions.requirement_type = requirementType;
      }
    }

    if (featureFlag.allocation) {
      featureFlagValue.allocation = {};
      const default_when_disabled = featureFlag.allocation[this.featureFlagsKeyWordsCase.default_when_disabled];
      if (default_when_disabled) {
        featureFlagValue.allocation.default_when_disabled = default_when_disabled;
      }

      const default_when_enabled = featureFlag.allocation[this.featureFlagsKeyWordsCase.default_when_enabled];
      if (default_when_enabled) {
        featureFlagValue.allocation.default_when_enabled = default_when_enabled;
      }

      const userAllocation = this.getObjectWithKey(featureFlag.allocation, "user");
      if (userAllocation) {
        featureFlagValue.allocation.user = [];
        for (const user of userAllocation) {
          if (!this.isValidUserAllocation(user)) {
            throw new ArgumentError(
              `This feature flag '${featureFlag.id}' has a user allocation object without the required 'variant' and 'users' properties.`
            );
          }
          featureFlagValue.allocation.user.push(user);
        }
      }

      const groupAllocation = this.getObjectWithKey(featureFlag.allocation, "group");
      if (groupAllocation) {
        featureFlagValue.allocation.group = [];
        for (const group of groupAllocation) {
          if (!this.isValidGroupAllocation(group)) {
            throw new ArgumentError(
              `This feature flag '${featureFlag.id}' has a group allocation object without the required 'variant' and 'groups' properties.`
            );
          }
          featureFlagValue.allocation.group.push(group);
        }
      }

      const percentileAllocation = this.getObjectWithKey(featureFlag.allocation, "percentile");
      if (percentileAllocation) {
        featureFlagValue.allocation.percentile = [];
        for (const percentile of percentileAllocation) {
          if (!this.isValidPercentileAllocation(percentile)) {
            throw new ArgumentError(
              `This feature flag '${featureFlag.id}' has a percentile allocation object without the required 'from', 'to' and 'variant' properties.`
            );
          }
          featureFlagValue.allocation.percentile.push(percentile);
        }
      }
    }

    if (featureFlag.variants) {
      featureFlagValue.variants = [];
      for (const variant of featureFlag.variants) {
        if (!this.isValidVariant(variant)) {
          throw new ArgumentError(
            `This feature flag '${featureFlag.id}' has a variant without the required 'name' property.`
          );
        }
        const status_override = variant[this.featureFlagsKeyWordsCase.status_override as keyof Variant];
        const configuration_value = variant[this.featureFlagsKeyWordsCase.configuration_value as keyof Variant];
        featureFlagValue.variants.push({
          name: variant.name,
          status_override: status_override as StatusOverride,
          configuration_value: configuration_value
        });
      }
    }

    return featureFlagValue;
  }

  private isValidUserAllocation(user: object): user is User {
    const lowerCaseUser = this.getLowerCaseProperties(user);
    return (
      typeof lowerCaseUser === "object" &&
      lowerCaseUser !== null &&
      typeof lowerCaseUser.variant === "string" &&
      Array.isArray(lowerCaseUser.users)
    );
  }

  private isValidGroupAllocation(group: object): group is Group {
    const lowerCaseGroup = this.getLowerCaseProperties(group);
    return (
      typeof lowerCaseGroup === "object" &&
      lowerCaseGroup !== null &&
      typeof lowerCaseGroup.variant === "string" &&
      Array.isArray(lowerCaseGroup.groups)
    );
  }

  private isValidPercentileAllocation(percentile: object): percentile is Percentile {
    const lowerCasePercentile = this.getLowerCaseProperties(percentile);
    return (
      typeof lowerCasePercentile === "object" &&
      lowerCasePercentile !== null &&
      typeof lowerCasePercentile.variant === "string" && 
      lowerCasePercentile.to === "string" && 
      lowerCasePercentile.from === "string"
    );
  }

  private isValidVariant(variant: any): variant is Variant {
    const status_override = variant[this.featureFlagsKeyWordsCase.status_override];
    return (
      typeof variant === "object" &&
      variant !== null &&
      typeof variant.name === "string" &&
      (status_override === undefined ||
        Object.values(StatusOverride).includes(status_override))
    );
  }

  private validateClientFilters(featureFlagName: string, schemaVersion: string, clientFilters: any[]): ClientFilter[] {
    let validatedClientFilters: ClientFilter[] = [];

    for (let i = 0; i < clientFilters.length; i++) {
      const parameters: Partial<ClientFilter> = {};
      //
      // Converting client_filter keys to lower case
      const lowerCaseFilters = this.getLowerCaseProperties(clientFilters[i]);

      const filtersName = lowerCaseFilters["name"];
      const filtersParameters = lowerCaseFilters["parameters"];

      if (filtersName) {
        if (filtersName.toLowerCase() == "alwayson" && schemaVersion == "ffv1") {
          validatedClientFilters = [];
          break;
        }
        parameters.name = filtersName;
        if (filtersParameters) {
          parameters.parameters = filtersParameters;
        }
        validatedClientFilters[i] = parameters as ClientFilter;
      }
      else {
        throw new ArgumentError(
          `This feature flag '${featureFlagName}' has a filter without the required 'name' property.`
        );
      }
    }

    return validatedClientFilters;
  }

  private checkIfUsingFFV2Schema(config: object): boolean {
    let foundFeatureFlagsKey = false;

    for (const key in config) {
      if (key == this.featureFlagsKeyWordsCase.feature_flags) {
        if (foundFeatureFlagsKey) {
          throw new ArgumentError(
            "Unable to proceed because data contains multiple sections corresponding to Feature Flags."
          );
        }
        foundFeatureFlagsKey = true;
      }
    }

    return foundFeatureFlagsKey;
  }

  private getLowerCaseProperties(config: object): { [key: string]: any } {
    const keys: Array<string> = Object.keys(config);
    const lowerCaseFilters: { [key: string]: any } = {};

    for (let i = 0; i < keys.length; i++) {
      lowerCaseFilters[keys[i].toLowerCase()] = config[keys[i] as keyof object];
    }

    return lowerCaseFilters;
  }

  private getObjectWithKey(config: {[key: string]: any }, key: string) {
    const normalizedKey = key.toLowerCase();
    const foundKey = Object.keys(config).find(k => k.toLowerCase() === normalizedKey);
    return foundKey ? config[foundKey] : null;
  }

  private validateRequirementType(requirement_type: any, featureFlagName: string) {
    if(!Object.values(RequirementType).includes(requirement_type)){
      throw new ArgumentError(
        `This feature flag '${featureFlagName}' must have any/all requirement type.`
      );
    }

    return true;
  }
}
