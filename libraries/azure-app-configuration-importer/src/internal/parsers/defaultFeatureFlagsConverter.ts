// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlagParam } from "@azure/app-configuration";
import { ArgumentError } from "../../errors";
import { SourceOptions } from "../../options";
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

type FeatureFlagConditions = NonNullable<FeatureFlagParam["conditions"]>;
type FeatureFlagVariant = NonNullable<FeatureFlagParam["variants"]>[number];
type FeatureFlagAllocation = NonNullable<FeatureFlagParam["allocation"]>;

/**
 * Reads the feature management sections of a default profile document as enhanced feature flags.
 *
 * Configuration key-values are ignored.
 *
 * @internal
 * */
export class DefaultFeatureFlagsConverter {
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
        if (!rawFeatureFlag.id) {
          throw new ArgumentError("Feature flag without id is found, id is a required property.");
        }
        this.validateFeatureName(rawFeatureFlag.id);

        const featureFlag = this.readMsFmFeatureFlag(rawFeatureFlag, options);
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

  private readMsFmFeatureFlag(rawFeatureFlag: Record<string, any>, options: SourceOptions): FeatureFlagParam {
    validateMsFmFeatureFlagSchema(rawFeatureFlag);

    const featureFlag: FeatureFlagParam = {
      name: (options.prefix ?? "") + rawFeatureFlag.id,
      enabled: rawFeatureFlag.enabled ?? false
    };

    if (options.label !== undefined) {
      featureFlag.label = options.label;
    }
    if (rawFeatureFlag.description !== undefined) {
      featureFlag.description = rawFeatureFlag.description;
    }
    if (rawFeatureFlag.conditions) {
      const conditions: FeatureFlagConditions = {};
      if (rawFeatureFlag.conditions.client_filters !== undefined) {
        conditions.filters = rawFeatureFlag.conditions.client_filters;
      }
      if (rawFeatureFlag.conditions.requirement_type !== undefined) {
        conditions.requirementType = rawFeatureFlag.conditions.requirement_type;
      }
      featureFlag.conditions = conditions;
    }
    if (rawFeatureFlag.variants) {
      featureFlag.variants = rawFeatureFlag.variants.map((variant: Record<string, any>) => this.readVariant(variant));
    }
    if (rawFeatureFlag.allocation) {
      featureFlag.allocation = this.readAllocation(rawFeatureFlag.allocation);
    }
    if (rawFeatureFlag.telemetry !== undefined) {
      featureFlag.telemetry = rawFeatureFlag.telemetry;
    }
    if (options.tags !== undefined) {
      featureFlag.tags = options.tags;
    }

    return featureFlag;
  }

  private readVariant(variant: Record<string, any>): FeatureFlagVariant {
    const enhancedVariant: FeatureFlagVariant = { name: variant.name };
    const variantValue = variant.configuration_value;

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
  }

  private readAllocation(allocation: Record<string, any>): FeatureFlagAllocation {
    const enhancedAllocation: FeatureFlagAllocation = {};

    if (allocation.user !== undefined) {
      enhancedAllocation.user = allocation.user;
    }
    if (allocation.group !== undefined) {
      enhancedAllocation.group = allocation.group;
    }
    if (allocation.percentile !== undefined) {
      enhancedAllocation.percentile = allocation.percentile;
    }
    if (allocation.seed !== undefined) {
      enhancedAllocation.seed = allocation.seed;
    }
    if (allocation.default_when_enabled !== undefined) {
      enhancedAllocation.defaultWhenEnabled = allocation.default_when_enabled;
    }
    if (allocation.default_when_disabled !== undefined) {
      enhancedAllocation.defaultWhenDisabled = allocation.default_when_disabled;
    }

    return enhancedAllocation;
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
