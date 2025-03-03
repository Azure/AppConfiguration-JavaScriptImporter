// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  SetConfigurationSettingParam,
  featureFlagPrefix,
  featureFlagContentType,
  SecretReferenceValue
} from "@azure/app-configuration";
import { SourceOptions } from "../../importOptions";
import { ConfigurationSettingsConverter } from "./configurationSettingsConverter";
import { AjvValidationError, ArgumentError } from "../../errors";
import { ClientFilter } from "../../models";
import * as flat from "flat";
import { ConfigurationFormat } from "../../enums";
import { isJsonContentType, serializeFeatureFlagToConfigurationSettingParam } from "../utils";
import { MsFeatureFlagValue, RequirementType } from "../../featureFlag";
import { Constants } from "../constants";
import { MsFeatureFlagValueSchema } from "../../MsFeatureFlagSchema";
import Ajv, { ErrorObject } from "ajv";

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
  ): SetConfigurationSettingParam<string | SecretReferenceValue>[] {
    let configurationSettings = new Array<
      SetConfigurationSettingParam<string>
    >();

    let featureFlagsConfigSettings = new Array<SetConfigurationSettingParam<string>>();
    let foundMsFmSchema = false;
    let foundDotnetFmSchema = false;
    let dotnetFmSchemaKeyWord = "";

    const featureFlagsDict: any = {};

    if (options.format == ConfigurationFormat.Properties && !options.skipFeatureFlags) {
      this.checkFeatureManagementExist(config);
    }

    for (let i = 0; i < Constants.FeatureManagementKeyWords.length - 1; i++) {
      if (Constants.FeatureManagementKeyWords[i] in config) {
        if (foundDotnetFmSchema) {
          throw new ArgumentError(
            `Unable to proceed because data contains multiple sections corresponding to Feature Management. with the key, ${Constants.FeatureManagementKeyWords[i]}`
          );
        }
        
        foundDotnetFmSchema = true;
        dotnetFmSchemaKeyWord = Constants.FeatureManagementKeyWords[i];

        const dotnetFmSchemaKey = dotnetFmSchemaKeyWord as keyof object;
        featureFlagsDict[dotnetFmSchemaKey] = config[dotnetFmSchemaKey];
        delete config[dotnetFmSchemaKey];
      }
    }

    const msFeatureManagementKeyWord = Constants.FeatureManagementKeyWords[3];
    if (msFeatureManagementKeyWord in config) {
      if (foundDotnetFmSchema &&
        Object.keys(config[msFeatureManagementKeyWord as keyof object]).some(key => key !== Constants.FeatureFlagsKeyWord)) {
        throw new ArgumentError(
          `Unable to proceed because data contains an already defined dotnet schema section with the key, ${dotnetFmSchemaKeyWord}.`
        );
      }

      if (Object.keys(config[msFeatureManagementKeyWord as keyof object]).includes(Constants.FeatureFlagsKeyWord)) {
        foundMsFmSchema = true;
      }

      if (Object.keys(config[msFeatureManagementKeyWord as keyof object]).some(key => key !== Constants.FeatureFlagsKeyWord)){
        foundDotnetFmSchema = true;
        dotnetFmSchemaKeyWord = msFeatureManagementKeyWord;
      }

      const featureManagementKey = msFeatureManagementKeyWord as keyof object;
      featureFlagsDict[featureManagementKey] = config[featureManagementKey];
      delete config[featureManagementKey];
    }

    if ((foundDotnetFmSchema || foundMsFmSchema) && !options.skipFeatureFlags) {
      const featureFlagConverter = new FeatureFlagConfigurationSettingsConverter(
        dotnetFmSchemaKeyWord,
        foundMsFmSchema
      );
      featureFlagsConfigSettings = featureFlagConverter.Convert(featureFlagsDict, options);
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
    for (const featureFlagKeyWord of Constants.FeatureManagementKeyWords) {
      if (keys.find(key => key.startsWith(featureFlagKeyWord))) {
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
  dotnetFmSchemaKeyWord: string;
  foundMsFeatureManagement: boolean;
  ajv: Ajv;

  constructor(dotnetFmSchemaKeyWord: string, foundMsFeatureManagement: boolean) {
    this.dotnetFmSchemaKeyWord = dotnetFmSchemaKeyWord;
    this.foundMsFeatureManagement = foundMsFeatureManagement;
    this.ajv = new Ajv();

    if (!this.dotnetFmSchemaKeyWord && !this.foundMsFeatureManagement) {
      throw new ArgumentError("No feature management was found");
    }
  }

  /**
   * @inheritdoc
   * */
  Convert(
    config: object,
    options: SourceOptions
  ): SetConfigurationSettingParam<string>[] {
    const settings = new Array<SetConfigurationSettingParam<string>>();
    const featureFlags = new Array<MsFeatureFlagValue>();

    if (this.dotnetFmSchemaKeyWord) {
      const dotnetSchemaFeatureFlags = this.getDotnetFmSchemaFeatureFlags(config);

      const featureManagementIndex: number = Constants.FeatureManagementKeyWords.indexOf(this.dotnetFmSchemaKeyWord);

      for (const featureFlag in dotnetSchemaFeatureFlags) {
        if (!this.validateFeatureName(featureFlag)) {
          throw new ArgumentError(
            `Feature flag ${featureFlag} contains invalid character,'%' and ':' are not allowed in feature name. Please provide valid feature name.`
          );
        }

        const featureFlagValue = this.getFeatureFlagValueFromDotnetSchema(
          featureFlag,
          dotnetSchemaFeatureFlags[featureFlag],
          Constants.EnabledForKeyWords[featureManagementIndex],
          Constants.RequirementTypeKeyWords[featureManagementIndex]
        );

        featureFlags.push(featureFlagValue);
      }
    }

    if (this.foundMsFeatureManagement) {
      const msFmSectionFeatureFlags = this.getMsFmSchemaFeatureFlags(config);

      for (const featureFlag of msFmSectionFeatureFlags) {
        if (!featureFlag.id) {
          throw new ArgumentError(
            "Feature flag without id is found, id is a required property."
          );
        }

        if (!this.validateFeatureName(featureFlag.id)) {
          throw new ArgumentError(
            `Feature flag id ${featureFlag.id} contains invalid character,'%' and ':' are not allowed.`
          );
        }

        const featureFlagValue = this.getFeatureFlagValueFromMsFmSchema(featureFlag);

        // Check if the featureFlag with the same id already exists
        // Replace the existing flag with the later one, the later one always wins
        const indexOfExistingFlag = featureFlags.findIndex(existingFeatureFlag => existingFeatureFlag.id === featureFlag.id);

        if (indexOfExistingFlag !== -1) {
          featureFlags[indexOfExistingFlag] = featureFlagValue;
        }
        else {
          featureFlags.push(featureFlagValue);
        }
      }
    }

    const prefix: string = options.prefix ?? "";
    for (const featureFlag of featureFlags) {
      const setting: SetConfigurationSettingParam<MsFeatureFlagValue> = {
        key: featureFlagPrefix + prefix + featureFlag.id,
        label: options.label,
        value: featureFlag,
        contentType: featureFlagContentType,
        tags: options.tags
      };

      const serializedSetting: SetConfigurationSettingParam<string> = serializeFeatureFlagToConfigurationSettingParam(setting);
      settings.push(serializedSetting);
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

  private getFeatureFlagValueFromDotnetSchema(
    featureFlagName: string,
    featureData: any,
    enabledForKeyWord: string,
    requirementTypeKeyWord: string
  ): MsFeatureFlagValue {
    const defaultFeatureConditions = { clientFilters: [] };

    const featureFlagValue: MsFeatureFlagValue = {
      id: featureFlagName,
      description: "",
      enabled: false,
      conditions: {
        clientFilters: []
      }
    };

    if (typeof featureData == "object") {
      const filters = featureData[enabledForKeyWord];

      if (!filters) {
        throw new ArgumentError(
          `Data contains feature flags in invalid format. Feature flag '${featureFlagName}' must contain '${enabledForKeyWord}' definition or have a true/false value.`
        );
      }

      if (filters.length != 0) {
        featureFlagValue.enabled = true;
        featureFlagValue.conditions.clientFilters = filters;

        if (featureFlagValue.conditions && featureFlagValue.conditions.clientFilters) {
          for (let i = 0; i < featureFlagValue.conditions.clientFilters.length; i++) {
            const parameters: Partial<ClientFilter> = {};
            //
            // Converting client_filter keys to lower case
            const lowerCaseFilters = this.getLowerCaseFilters(
              featureFlagValue.conditions.clientFilters[i]
            );

            const filtersName = lowerCaseFilters["name"];
            const filtersParameters = lowerCaseFilters["parameters"];

            if (filtersName) {
              if (filtersName.toLowerCase() == "alwayson") {
                featureFlagValue.conditions = defaultFeatureConditions;
                break;
              }
              parameters.name = filtersName;
              if (filtersParameters) {
                parameters.parameters = filtersParameters;
              }

              featureFlagValue.conditions.clientFilters[i] = parameters as ClientFilter;
            }
            else {
              throw new ArgumentError(
                `This feature flag '${featureFlagName}' has a filter without the required 'name' property.`
              );
            }
          }
        }
      }

      const requirementType = featureData[requirementTypeKeyWord];

      if (requirementType) {
        if (this.validateRequirementType(featureFlagName, requirementType)) {
          featureFlagValue.conditions.requirementType = requirementType;
        }
      }
    }
    else if (typeof featureData == "boolean") {
      featureFlagValue.enabled = featureData;
    }
    else {
      throw new ArgumentError(
        `Data contains feature flags in invalid format. The type of ${featureFlagName} should be either boolean or dictionary.`
      );
    }

    return featureFlagValue;
  }

  private getFeatureFlagValueFromMsFmSchema(featureFlag: any): MsFeatureFlagValue {
    const validate = this.ajv.compile<MsFeatureFlagValue>(MsFeatureFlagValueSchema);
    const featureFlagCopy = JSON.parse(JSON.stringify(featureFlag)); //deep copy

    // normalize client filters
    if (featureFlagCopy.conditions && featureFlagCopy.conditions.client_filters) {
      for (let i = 0; i < featureFlagCopy.conditions.client_filters.length; i++) {
        featureFlagCopy.conditions.client_filters[i] = this.getLowerCaseFilters(featureFlagCopy.conditions.client_filters[i]);
      }
    }

    const valid = validate(featureFlagCopy);
    if (!valid) {
      const validationError = new AjvValidationError(validate.errors as ErrorObject[]);
      throw new ArgumentError(`Feature flag '${featureFlag.id}' is not in the correct format. ${validationError.getFriendlyMessage()}`);
    }

    const parsedFeatureFlag: MsFeatureFlagValue = {
      ...featureFlag,
      conditions: {
        clientFilters: featureFlag.conditions?.client_filters ?? []
      }
    };

    if (featureFlag.display_name) {
      parsedFeatureFlag.displayName = featureFlag.display_name;
    }

    if (featureFlag.conditions?.requirement_type) {
      parsedFeatureFlag.conditions.requirementType = featureFlag.conditions.requirement_type;
    }

    return parsedFeatureFlag;
  }

  private getLowerCaseFilters(clientFilter: ClientFilter): { [key: string]: any } {
    const keys: Array<string> = Object.keys(clientFilter);
    const lowerCaseFilters: { [key: string]: any } = {};

    for (let i = 0; i < keys.length; i++) {
      lowerCaseFilters[keys[i].toLowerCase()] = clientFilter[keys[i] as keyof object];
    }

    return lowerCaseFilters;
  }

  private validateRequirementType(requirement_type: any, featureFlagName: string) {
    if(!Object.values(RequirementType).includes(requirement_type)){
      throw new ArgumentError(
        `This feature flag '${featureFlagName}' must have any/all requirement type.`
      );
    }

    return true;
  }

  private getMsFmSchemaFeatureFlags(config: object): Array<{ [key: string]: any }>{
    const msFeatureManagementKeyWord = Constants.FeatureManagementKeyWords[3];
    const featureManagementKey =  msFeatureManagementKeyWord as keyof object;
    const featureManagementSection = config[featureManagementKey];

    if (typeof featureManagementSection !== "object") {
      throw new ArgumentError(`The ${msFeatureManagementKeyWord} section must be an object.`);
    }

    if (!Array.isArray(featureManagementSection[Constants.FeatureFlagsKeyWord])) {
      throw new ArgumentError(`The ${Constants.FeatureFlagsKeyWord} key within ${msFeatureManagementKeyWord} must be an array.`);
    }

    return featureManagementSection[Constants.FeatureFlagsKeyWord];
  }

  private getDotnetFmSchemaFeatureFlags(config: object): { [key: string]: any } {
    const msFeatureManagementKeyWord = Constants.FeatureManagementKeyWords[3];
    const featureManagementSection: object = config[this.dotnetFmSchemaKeyWord as keyof object];

    if (typeof featureManagementSection !== "object") {
      throw new ArgumentError(`The ${this.dotnetFmSchemaKeyWord} section must be an object.`);
    }

    if (this.dotnetFmSchemaKeyWord === msFeatureManagementKeyWord) { //dotnet schema might be nested within msFmSchema
      const { feature_flags, ...dotnetSchemaFeatureFlags } = featureManagementSection as { [key: string]: any };
      return dotnetSchemaFeatureFlags;
    }
    else {
      return featureManagementSection;
    }
  }
}
