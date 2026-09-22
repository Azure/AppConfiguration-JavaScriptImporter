// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlagParam } from "@azure/app-configuration";
import { ArgumentError } from "../../errors";
import { SourceOptions } from "../../options";
import { Constants } from "../constants";
import {
  convertToFeatureFlagParam,
  detectFeatureManagement,
  getDotnetSchemaFeatureFlags,
  getMsFmSchemaFeatureFlags,
  isValidFeatureName,
  lowerCaseKeys,
  validateMsFmEnhancedFeatureFlagSchema,
  validateMsFmFeatureFlagSchema,
  validateRequirementType
} from "./featureManagementParser";
import { FeatureFlagParamConverter } from "./featureFlagParamConverter";

type FeatureFlagConditions = NonNullable<FeatureFlagParam["conditions"]>;

/**
 * Reads the feature management sections of a default profile document as enhanced feature flags.
 *
 * Configuration key-values are ignored.
 *
 * @internal
 * */
export class DefaultFeatureFlagsConverter implements FeatureFlagParamConverter {
  public Convert(config: object, options: SourceOptions): FeatureFlagParam[] {
    const { featureFlagsDict, dotnetFmSchemaKeyWord, foundMsFmSchema, foundFeatureManagement } =
      detectFeatureManagement(config, options);

    if (!foundFeatureManagement) {
      return [];
    }

    const featureFlags: FeatureFlagParam[] = [];

    if (dotnetFmSchemaKeyWord) {
      const schemaIndex = Constants.FeatureManagementKeyWords.indexOf(dotnetFmSchemaKeyWord);
      const dotnetFeatureFlags = getDotnetSchemaFeatureFlags(featureFlagsDict, dotnetFmSchemaKeyWord);
      for (const name in dotnetFeatureFlags) {
        this.validateFeatureName(name);
        featureFlags.push(this.readDotnetFeatureFlag(
          name,
          dotnetFeatureFlags[name],
          Constants.EnabledForKeyWords[schemaIndex],
          Constants.RequirementTypeKeyWords[schemaIndex],
          options
        ));
      }
    }

    if (foundMsFmSchema) {
      for (const rawFeatureFlag of getMsFmSchemaFeatureFlags(featureFlagsDict)) {
        const featureFlag = this.readFeatureFlag(rawFeatureFlag, options);
        // The later flag with the same name always wins.
        const existingIndex = featureFlags.findIndex(existing => existing.name === featureFlag.name);
        if (existingIndex !== -1) {
          featureFlags[existingIndex] = featureFlag;
        }
        else {
          featureFlags.push(featureFlag);
        }
      }
    }

    return featureFlags;
  }

  private readFeatureFlag(rawFeatureFlag: Record<string, unknown>, options: SourceOptions): FeatureFlagParam {
    const hasId = rawFeatureFlag.id !== undefined;
    const hasName = rawFeatureFlag.name !== undefined;

    // A single entry must use either the Microsoft Feature Management shape (id) or the enhanced shape (name), never both.
    if (hasId && hasName) {
      throw new ArgumentError(
        "Feature flag contains both 'id' and 'name'. Use 'id' for the Microsoft Feature Management schema or 'name' for the enhanced schema, not both."
      );
    }
    if (!hasId && !hasName) {
      throw new ArgumentError("Feature flag without id is found, id is a required property.");
    }

    if (hasId) {
      this.validateFeatureName(String(rawFeatureFlag.id));
      validateMsFmFeatureFlagSchema(rawFeatureFlag);
    }
    else {
      this.validateFeatureName(String(rawFeatureFlag.name));
      validateMsFmEnhancedFeatureFlagSchema(rawFeatureFlag);
    }

    const featureFlag = convertToFeatureFlagParam(rawFeatureFlag);
    featureFlag.name = (options.prefix ?? "") + featureFlag.name;
    if (options.label !== undefined) {
      featureFlag.label = options.label;
    }
    if (options.tags !== undefined) {
      featureFlag.tags = options.tags;
    }

    return featureFlag;
  }

  private readDotnetFeatureFlag(
    name: string,
    featureData: any,
    enabledForKeyWord: string,
    requirementTypeKeyWord: string,
    options: SourceOptions
  ): FeatureFlagParam {
    const featureFlag: FeatureFlagParam = {
      name: (options.prefix ?? "") + name,
      enabled: false
    };

    if (options.label !== undefined) {
      featureFlag.label = options.label;
    }

    if (typeof featureData === "boolean") {
      featureFlag.enabled = featureData;
      return featureFlag;
    }

    if (typeof featureData !== "object" || featureData === null) {
      throw new ArgumentError(
        `Data contains feature flags in invalid format. The type of ${name} should be either boolean or dictionary.`
      );
    }

    const filters = featureData[enabledForKeyWord];
    if (!filters) {
      throw new ArgumentError(
        `Data contains feature flags in invalid format. Feature flag '${name}' must contain '${enabledForKeyWord}' definition or have a true/false value.`
      );
    }

    const conditions: FeatureFlagConditions = {};
    if (filters.length !== 0) {
      featureFlag.enabled = true;

      const parsedFilters: NonNullable<FeatureFlagConditions["filters"]> = [];
      let alwaysOn = false;
      for (const filter of filters) {
        const lowerCaseFilter = lowerCaseKeys(filter);
        const filterName = lowerCaseFilter["name"];
        if (!filterName) {
          throw new ArgumentError(`This feature flag '${name}' has a filter without the required 'name' property.`);
        }
        if (filterName.toLowerCase() === "alwayson") {
          alwaysOn = true;
          break;
        }
        const parsedFilter: NonNullable<FeatureFlagConditions["filters"]>[number] = { name: filterName };
        if (lowerCaseFilter["parameters"]) {
          parsedFilter.parameters = lowerCaseFilter["parameters"];
        }
        parsedFilters.push(parsedFilter);
      }

      if (!alwaysOn) {
        conditions.filters = parsedFilters;
      }
    }

    const requirementType = featureData[requirementTypeKeyWord];
    if (requirementType) {
      validateRequirementType(name, requirementType);
      conditions.requirementType = requirementType;
    }

    if (conditions.filters !== undefined || conditions.requirementType !== undefined) {
      featureFlag.conditions = conditions;
    }

    return featureFlag;
  }

  private validateFeatureName(name: string): void {
    if (!isValidFeatureName(name)) {
      throw new ArgumentError(
        `Feature flag ${name} contains invalid character,'%' and ':' are not allowed in feature name. Please provide valid feature name.`
      );
    }
  }
}
