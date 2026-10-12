// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  SetConfigurationSettingParam,
  featureFlagPrefix,
  featureFlagContentType,
  SecretReferenceValue
} from "@azure/app-configuration";
import { SourceOptions } from "../../options";
import { ConfigurationSettingsConverter } from "./configurationSettingsConverter";
import { ArgumentError } from "../../errors";
import { ClientFilter } from "../../models";
import * as flat from "flat";
import { isJsonContentType, serializeFeatureFlagValue } from "../utils";
import { MsFeatureFlagValue } from "../../featureFlag";
import { Constants } from "../constants";
import {
  detectFeatureManagement,
  getDotnetSchemaFeatureFlags,
  getMsFmSchemaFeatureFlags,
  isValidFeatureName,
  lowerCaseKeys,
  validateMsFmFeatureFlagSchema,
  validateRequirementType
} from "./featureManagementParser";

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

    const { featureFlagsDict, dotnetFmSchemaKeyWord, foundMsFmSchema, foundFeatureManagement } =
      detectFeatureManagement(config, options);

    if (foundFeatureManagement && !options.skipFeatureFlags) {
      featureFlagsConfigSettings = new FeatureFlagConfigurationSettingsConverter(
        dotnetFmSchemaKeyWord,
        foundMsFmSchema
      ).Convert(featureFlagsDict, options);
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
export class FeatureFlagConfigurationSettingsConverter implements ConfigurationSettingsConverter {
  dotnetFmSchemaKeyWord: string;
  foundMsFeatureManagement: boolean;

  constructor(dotnetFmSchemaKeyWord: string, foundMsFeatureManagement: boolean) {
    this.dotnetFmSchemaKeyWord = dotnetFmSchemaKeyWord;
    this.foundMsFeatureManagement = foundMsFeatureManagement;

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
    const featureFlags = this.ToFeatureFlagValues(config);

    const prefix: string = options.prefix ?? "";
    for (const featureFlag of featureFlags) {
      const setting: SetConfigurationSettingParam<string> = {
        key: featureFlagPrefix + prefix + featureFlag.id,
        label: options.label,
        value: serializeFeatureFlagValue(featureFlag),
        contentType: featureFlagContentType,
        tags: options.tags
      };

      settings.push(setting);
    }

    return settings;
  }

  /**
   * Parse the feature management sections into feature flag values.
   * */
  ToFeatureFlagValues(config: object): MsFeatureFlagValue[] {
    const featureFlags = new Array<MsFeatureFlagValue>();

    if (this.dotnetFmSchemaKeyWord) {
      const dotnetSchemaFeatureFlags = getDotnetSchemaFeatureFlags(config, this.dotnetFmSchemaKeyWord);

      const featureManagementIndex: number = Constants.FeatureManagementKeyWords.indexOf(this.dotnetFmSchemaKeyWord);

      for (const featureFlag in dotnetSchemaFeatureFlags) {
        if (!isValidFeatureName(featureFlag)) {
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
      const msFmSectionFeatureFlags = getMsFmSchemaFeatureFlags(config);

      for (const featureFlag of msFmSectionFeatureFlags) {
        if (!featureFlag.id) {
          throw new ArgumentError(
            "Feature flag without id is found, id is a required property."
          );
        }

        if (!isValidFeatureName(featureFlag.id)) {
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

    return featureFlags;
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
            const lowerCaseFilters = lowerCaseKeys(
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
        validateRequirementType(featureFlagName, requirementType);
        featureFlagValue.conditions.requirementType = requirementType;
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
    validateMsFmFeatureFlagSchema(featureFlag);

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

}
