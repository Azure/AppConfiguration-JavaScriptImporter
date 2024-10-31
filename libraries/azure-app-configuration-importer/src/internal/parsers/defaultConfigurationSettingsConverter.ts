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
import { AjvValidationError, ArgumentError } from "../../errors";
import { ClientFilter } from "../../models";
import * as flat from "flat";
import { ConfigurationFormat } from "../../enums";
import { isJsonContentType } from "../utils";
import { FeatureFlagValue, RequirementType } from "../../featureFlag";
import { Constants } from "../constants";
import { featureFlagValueSchema } from "../../featureFlagSchema";
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
      SetConfigurationSettingParam
    >();

    let featureFlagsConfigSettings = new Array<SetConfigurationSettingParam>();
    let foundMsFmSchema = false;
    let foundLegacySchema = false;
    let msFmFeatureManagementKeyWord = "";
    let legacySchemaFeatureManagementKeyWord = "";
    let legacySchemaEnabledForKeyWord = "";
    let legachSchemaRequirementTypeKeyWord = "";

    const featureFlagsDict: any = {};

    if (options.format == ConfigurationFormat.Properties && !options.skipFeatureFlags) {
      this.checkFeatureManagementExist(config);
    }

    for (let i = 0; i < Constants.FeatureManagementKeyWords.length; i++) {
      if (Constants.FeatureManagementKeyWords[i] in config) {
        if (Constants.FeatureManagementKeyWords[i] == Constants.FeatureManagementKeyWords[2]) { //feature_management
          if (foundMsFmSchema) {
            throw new ArgumentError(
              `Unable to proceed because data contains multiple sections corresponding to Feature Management with the key, ${Constants.FeatureManagementKeyWords[i]}`
            );
          }
          foundMsFmSchema = true;
          msFmFeatureManagementKeyWord = Constants.FeatureManagementKeyWords[i];
          const featureManagementKey = msFmFeatureManagementKeyWord as keyof object;
          featureFlagsDict[featureManagementKey] = config[featureManagementKey];
          delete config[featureManagementKey];
        }
        else {   
          if (foundLegacySchema) {
            throw new ArgumentError(
              `Unable to proceed because data contains multiple sections corresponding to Feature Flags. with the key, ${Constants.FeatureManagementKeyWords[i]}`
            );
          }
          foundLegacySchema = true;
          legacySchemaFeatureManagementKeyWord = Constants.FeatureManagementKeyWords[i];
          legacySchemaEnabledForKeyWord = Constants.EnabledForKeyWords[i];
          legachSchemaRequirementTypeKeyWord = Constants.RequirementTypeKeyWords[i];
          const legacyFeatureManagementKey = legacySchemaFeatureManagementKeyWord as keyof object;
          featureFlagsDict[legacyFeatureManagementKey] = config[legacyFeatureManagementKey];
          delete config[legacyFeatureManagementKey];
        }
      }
    }

    if ((foundLegacySchema || foundMsFmSchema) && !options.skipFeatureFlags) {
      const featureFlagConverter = new FeatureFlagConfigurationSettingsConverter(
        legacySchemaFeatureManagementKeyWord,
        msFmFeatureManagementKeyWord,
        legacySchemaEnabledForKeyWord,
        legachSchemaRequirementTypeKeyWord
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
  legacySchemaFeatureManagementKeyWord: string;
  msFmFeatureManagementKeyWord: string;
  legacySchemaEnabledForKeyWord: string;
  legacySchemaRequirmentTypeKeyWord: string;
  ajv: Ajv; 
  constructor(legacySchemaFeatureManagementKeyWord: string, msFmFeatureManagementKeyWord: string, legacySchemaEnabledForKeyWord: string, legacySchemaRequirmentTypeKeyWord: string ) {
    this.legacySchemaFeatureManagementKeyWord = legacySchemaFeatureManagementKeyWord;
    this.msFmFeatureManagementKeyWord = msFmFeatureManagementKeyWord;
    this.legacySchemaEnabledForKeyWord = legacySchemaEnabledForKeyWord;
    this.legacySchemaRequirmentTypeKeyWord = legacySchemaRequirmentTypeKeyWord;
    this.ajv = new Ajv();

    if (!this.legacySchemaFeatureManagementKeyWord && !this.msFmFeatureManagementKeyWord) {
      throw new ArgumentError("No feature management was found");
    }
  }

  /**
   * @inheritdoc
   * */
  Convert(
    config: object,
    options: SourceOptions
  ): SetConfigurationSettingParam[] {
    const settings = new Array<SetConfigurationSettingParam>();
    const featureFlags = new Array<FeatureFlagValue>();

    if (this.msFmFeatureManagementKeyWord) {
      const msFmSectionFeatureFlags = this.getMsFmSchemaSection(config);
      if (msFmSectionFeatureFlags) {
        for (const featureFlag of msFmSectionFeatureFlags) {
          if (!featureFlag.id) {
            throw new ArgumentError(
              `Feature flag ${featureFlag} is in an invalid format: id is a required property`
            );
          }

          if (!this.validateFeatureName(featureFlag.id)) {
            throw new ArgumentError(
              `Feature flag ${featureFlag} contains invalid character,'%' and ':' are not allowed in feature name. Please provide valid feature id.`
            );
          }
          featureFlags.push(this.getFeatureFlagDefinitionFromMsFmSchema(featureFlag));
        }
      }
    }

    const legacySchemaFeatureFlags = this.getLegacySchema(config);
    if (legacySchemaFeatureFlags) {
      for (const featureFlag in legacySchemaFeatureFlags) {
        if (!this.validateFeatureName(featureFlag)) {
          throw new ArgumentError(
            `Feature flag ${featureFlag} contains invalid character,'%' and ':' are not allowed in feature name. Please provide valid feature name.`
          );
        }

        const featureFlagDefinition = this.getFeatureFlagDefinitionFromLegacySchema(
          featureFlag,
          legacySchemaFeatureFlags,
          this.legacySchemaEnabledForKeyWord,
          this.legacySchemaRequirmentTypeKeyWord
        );
        
        // Check if the featureFlag with the same id already exists
        // feature flag written in Microsoft schema has higher priority
        const featureFlagExists = featureFlags.some(existingFeatureFlag => existingFeatureFlag.id === featureFlagDefinition.id);
        
        if (!featureFlagExists) {
          featureFlags.push(featureFlagDefinition);
        }
      }
    }

    const prefix: string = options.prefix ?? "";
    for (const featureFlag of featureFlags) {
      const setting: SetConfigurationSettingParam = {
        key: featureFlagPrefix + prefix + featureFlag.id,
        label: options.label,
        value: JSON.stringify(featureFlag),
        contentType: featureFlagContentType,
        tags: options.tags
      };

      settings.push(setting);
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

  private getFeatureFlagDefinitionFromLegacySchema(
    featureFlagName: any,
    featureData: any,
    enabledForKeyWord: string,
    requirementTypeKeyWord: string
  ): FeatureFlagValue {
    const defaultFeatureConditions = { client_filters: [] };

    const featureFlagValue: FeatureFlagValue = {
      id: featureFlagName,
      description: "",
      enabled: false
    };

    featureFlagValue.conditions = defaultFeatureConditions;

    if (typeof featureData[featureFlagName] == "object") {
      const filters = featureData[featureFlagName][enabledForKeyWord];
      if (!filters) {
        throw new ArgumentError(
          `Data contains feature flags in invalid format. Feature flag '${featureFlagName}' must contain '${enabledForKeyWord}' definition or have a true/false value.`
        );
      }

      if (filters.length != 0) {
        featureFlagValue.enabled = true;
        featureFlagValue.conditions.client_filters = filters;
        if (featureFlagValue.conditions && featureFlagValue.conditions.client_filters) {
          for (let i = 0; i < featureFlagValue.conditions.client_filters.length; i++) {
            const parameters: Partial<ClientFilter> = {};
            //
            // Converting client_filter keys to lower case
            const lowerCaseFilters = this.getLowerCaseFilters(
              featureFlagValue.conditions.client_filters[i]
            );

            const filtersName = lowerCaseFilters["name"];
            const filtersParameters = lowerCaseFilters["parameters"];

            if (filtersName) {
              if (filtersName.toLowerCase() == "alwayson") {
                featureFlagValue.conditions.client_filters = [];
                break;
              }
              parameters.name = filtersName;
              if (filtersParameters) {
                parameters.parameters = filtersParameters;
              }

              featureFlagValue.conditions.client_filters[i] = parameters as ClientFilter;
            }
            else {
              throw new ArgumentError(
                `This feature flag '${featureFlagName}' has a filter without the required 'name' property.`
              );
            }
          }
        }
      }

      const requirementType = featureData[featureFlagName][requirementTypeKeyWord];
      if (requirementType) {
        if (this.validateRequirementType(featureFlagName, requirementType)) {
          featureFlagValue.conditions.requirement_type = requirementType;
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

  private getFeatureFlagDefinitionFromMsFmSchema(featureFlag: any): FeatureFlagValue {
    const validate = this.ajv.compile<FeatureFlagValue>(featureFlagValueSchema);
    const featureFlagCopy = JSON.parse(JSON.stringify(featureFlag)); //deep copy

    //normalize client filters
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

    return featureFlag;
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

  private getMsFmSchemaSection(config: object): any {
    const featureManagementKey = this.msFmFeatureManagementKeyWord as keyof object;
    const featureManagementSection = config[featureManagementKey];
    if (featureManagementSection && typeof featureManagementSection === "object") {
      if (!Array.isArray(featureManagementSection[Constants.FeatureFlagsKeyWord])) {
        throw new ArgumentError(`The ${Constants.FeatureFlagsKeyWord} key within ${this.msFmFeatureManagementKeyWord} must be an array.`);
      }
      return featureManagementSection[Constants.FeatureFlagsKeyWord];
    }
  }

  private getLegacySchema(config: object): any {
    if (this.legacySchemaFeatureManagementKeyWord) {
      const featureManagementSection = config[this.legacySchemaFeatureManagementKeyWord as keyof object];
      if (featureManagementSection && typeof featureManagementSection === "object") {
        return featureManagementSection;
      }
    }

    if (this.msFmFeatureManagementKeyWord) {
      //feature_management - legacy schema might be nested within it.
      const featureManagementSection = config[this.msFmFeatureManagementKeyWord as keyof object];
      if (featureManagementSection && typeof featureManagementSection === "object") {
        const { feature_flags, ...rest } = featureManagementSection as { [key: string]: any };
        if (Object.keys(rest).length > 0) {
          return rest;
        }
      }
    }
  }
}
