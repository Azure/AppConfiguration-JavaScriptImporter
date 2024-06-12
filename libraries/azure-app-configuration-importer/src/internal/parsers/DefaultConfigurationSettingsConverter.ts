// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  SetConfigurationSettingParam,
  FeatureFlagValue,
  SecretReferenceValue,
  featureFlagPrefix,
  featureFlagContentType
} from "@azure/app-configuration";
import { SourceOptions } from "../../importOptions";
import { ConfigurationSettingsConverter } from "./ConfigurationSettingsConverter";
import { Constants } from "../constants";
import { ArgumentError } from "../../errors";
import { ClientFilter } from "../../models";
import * as flat from "flat";
import { ConfigurationFormat } from "../../enums";
import { isJsonContentType } from "../utils";

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
    let enabledForKeyWord = "";

    if (options.format == ConfigurationFormat.Properties && !options.skipFeatureFlags) {
      this.checkFeatureManagementExist(config);
    }

    for (let i = 0; i < Constants.FeatureManagementKeyWords.length; i++) {
      if (Constants.FeatureManagementKeyWords[i] in config) {
        if (foundFeatureManagement) {
          throw new ArgumentError(
            "Unable to proceed because data contains multiple sections corresponding to Feature Management."
          );
        }

        featureManagementKeyWord = Constants.FeatureManagementKeyWords[i];
        enabledForKeyWord = Constants.EnabledForKeyWords[i];
        const featureManagementKey = featureManagementKeyWord as keyof object;
        featureFlags = config[featureManagementKey];
        delete config[featureManagementKey];
        foundFeatureManagement = true;
      }
    }

    if (foundFeatureManagement && !options.skipFeatureFlags) {
      const featureFlagConverter = new FeatureFlagConfigurationSettingsConverter(
        featureManagementKeyWord,
        enabledForKeyWord
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
      if (!isJsonType && typeof flatted[element] === "object" && Object.keys(flatted[element]).length == 0 ) {
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
  enabledForKeyWord: string;
  constructor(featureManagementKeyWord: string, enabledForKeyWord: string) {
    this.featureManagementKeyWord = featureManagementKeyWord;
    this.enabledForKeyWord = enabledForKeyWord;

    if (!this.featureManagementKeyWord || !this.enabledForKeyWord) {
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
        value: this.getFeatureFlagValue(
          featureFlag,
          config,
          this.enabledForKeyWord
        ),
        contentType: featureFlagContentType,
        tags: options.tags
      });
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

  private getFeatureFlagValue(
    featureFlagName: any,
    featureData: any,
    enabledForKeyWord: string
  ): FeatureFlagValue {
    const defaultFeatureConditions = { clientFilters: [] };

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

  private getLowerCaseFilters(clientFilter: ClientFilter): { [key: string]: any } {
    const keys: Array<string> = Object.keys(clientFilter);
    const lowerCaseFilters: { [key: string]: any } = {};

    for (let i = 0; i < keys.length; i++) {
      lowerCaseFilters[keys[i].toLowerCase()] = clientFilter[keys[i] as keyof object];
    }

    return lowerCaseFilters;
  }
}
