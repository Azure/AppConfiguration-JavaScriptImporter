// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AjvValidationError, ArgumentError } from "../../errors";
import { ConfigurationFormat } from "../../enums";
import { RequirementType } from "../../featureFlag";
import { SourceOptions } from "../../options";
import { Constants } from "../constants";
import { MsFeatureFlagEnhancedValueSchema, MsFeatureFlagValueSchema } from "../../MsFeatureFlagSchema";
import { FeatureFlagParam } from "@azure/app-configuration";
import Ajv, { ErrorObject } from "ajv";

const msFmFeatureFlagValidator = new Ajv().compile(MsFeatureFlagValueSchema);
const msFmEnhancedFeatureFlagValidator = new Ajv().compile(MsFeatureFlagEnhancedValueSchema);

type FeatureFlagConditions = NonNullable<FeatureFlagParam["conditions"]>;
type FeatureFlagVariant = NonNullable<FeatureFlagParam["variants"]>[number];
type FeatureFlagAllocation = NonNullable<FeatureFlagParam["allocation"]>;

/**
 * Splits the feature management sections out of a parsed configuration document.
 *
 * @internal
 * */
export function detectFeatureManagement(
  config: any,
  options: SourceOptions
): {
  featureFlagsDict: any;
  dotnetFmSchemaKeyWord: string;
  foundMsFmSchema: boolean;
  foundFeatureManagement: boolean;
} {
  let foundMsFmSchema = false;
  let foundDotnetFmSchema = false;
  let dotnetFmSchemaKeyWord = "";
  const featureFlagsDict: any = {};

  if (options.format == ConfigurationFormat.Properties && !options.skipFeatureFlags) {
    checkFeatureManagementExist(config);
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

    if (Object.keys(config[msFeatureManagementKeyWord as keyof object]).some(key => key !== Constants.FeatureFlagsKeyWord)) {
      foundDotnetFmSchema = true;
      dotnetFmSchemaKeyWord = msFeatureManagementKeyWord;
    }

    const featureManagementKey = msFeatureManagementKeyWord as keyof object;
    featureFlagsDict[featureManagementKey] = config[featureManagementKey];
    delete config[featureManagementKey];
  }

  return {
    featureFlagsDict,
    dotnetFmSchemaKeyWord,
    foundMsFmSchema,
    foundFeatureManagement: foundDotnetFmSchema || foundMsFmSchema
  };
}

/**
 * Reads the MS feature management schema feature flags from the split sections.
 *
 * @internal
 * */
export function getMsFmSchemaFeatureFlags(featureFlagsDict: any): Array<{ [key: string]: any }> {
  const msFeatureManagementKeyWord = Constants.FeatureManagementKeyWords[3];
  const featureManagementSection = featureFlagsDict[msFeatureManagementKeyWord];

  if (typeof featureManagementSection !== "object") {
    throw new ArgumentError(`The ${msFeatureManagementKeyWord} section must be an object.`);
  }

  if (!Array.isArray(featureManagementSection[Constants.FeatureFlagsKeyWord])) {
    throw new ArgumentError(`The ${Constants.FeatureFlagsKeyWord} key within ${msFeatureManagementKeyWord} must be an array.`);
  }

  return featureManagementSection[Constants.FeatureFlagsKeyWord];
}

/**
 * Reads the dotnet feature management schema feature flags from the split sections.
 *
 * @internal
 * */
export function getDotnetSchemaFeatureFlags(featureFlagsDict: any, dotnetFmSchemaKeyWord: string): { [key: string]: any } {
  const msFeatureManagementKeyWord = Constants.FeatureManagementKeyWords[3];
  const featureManagementSection: object = featureFlagsDict[dotnetFmSchemaKeyWord];

  if (typeof featureManagementSection !== "object") {
    throw new ArgumentError(`The ${dotnetFmSchemaKeyWord} section must be an object.`);
  }

  if (dotnetFmSchemaKeyWord === msFeatureManagementKeyWord) { //dotnet schema might be nested within msFmSchema
    const { feature_flags, ...dotnetSchemaFeatureFlags } = featureManagementSection as { [key: string]: any };
    return dotnetSchemaFeatureFlags;
  }

  return featureManagementSection;
}

/**
 * Lower-cases the keys of a record so schema validation is case-insensitive.
 *
 * @internal
 * */
export function lowerCaseKeys(value: Record<string, any>): { [key: string]: any } {
  const result: { [key: string]: any } = {};
  for (const key of Object.keys(value)) {
    result[key.toLowerCase()] = value[key];
  }
  return result;
}

/**
 * Returns whether a feature flag name is free of the reserved '%' and ':' characters.
 *
 * @internal
 * */
export function isValidFeatureName(name: string): boolean {
  return !!name && /^[^:%]*$/.test(name);
}

/**
 * Validates that a requirement type is one of the supported values.
 *
 * @internal
 * */
export function validateRequirementType(name: string, requirementType: any): void {
  if (!Object.values(RequirementType).includes(requirementType)) {
    throw new ArgumentError(`This feature flag '${name}' must have any/all requirement type.`);
  }
}

/**
 * Validates a MS feature management schema feature flag against the MsFeatureFlagValue schema.
 *
 * @internal
 * */
export function validateMsFmFeatureFlagSchema(rawFeatureFlag: Record<string, any>): void {
  const featureFlagCopy = JSON.parse(JSON.stringify(rawFeatureFlag));

  // Normalize client filter keys so PascalCase filters pass validation.
  if (featureFlagCopy.conditions && featureFlagCopy.conditions.client_filters) {
    for (let i = 0; i < featureFlagCopy.conditions.client_filters.length; i++) {
      featureFlagCopy.conditions.client_filters[i] = lowerCaseKeys(featureFlagCopy.conditions.client_filters[i]);
    }
  }

  if (!msFmFeatureFlagValidator(featureFlagCopy)) {
    const validationError = new AjvValidationError(msFmFeatureFlagValidator.errors as ErrorObject[]);
    throw new ArgumentError(`Feature flag '${rawFeatureFlag.id}' is not in the correct format. ${validationError.getFriendlyMessage()}`);
  }
}

/**
 * Validates an enhanced feature flag against the MsFeatureFlagEnhancedValue schema.
 *
 * @internal
 * */
export function validateEnhancedFeatureFlagSchema(rawFeatureFlag: Record<string, unknown>, index?: number): void {
  if (!msFmEnhancedFeatureFlagValidator(rawFeatureFlag)) {
    const validationError = new AjvValidationError(msFmEnhancedFeatureFlagValidator.errors as ErrorObject[]);
    const descriptor = typeof rawFeatureFlag?.name === "string" && rawFeatureFlag.name.length > 0
      ? `'${rawFeatureFlag.name}' `
      : index !== undefined ? `at index ${index} ` : "";
    throw new ArgumentError(`Feature flag ${descriptor}is not in the correct format. ${validationError.getFriendlyMessage()}`);
  }
}

function checkFeatureManagementExist(configurations: object): void {
  const keys: string[] = Object.keys(configurations);
  for (const featureFlagKeyWord of Constants.FeatureManagementKeyWords) {
    if (keys.find(key => key.startsWith(featureFlagKeyWord))) {
      throw new ArgumentError("Importing feature flag in Properties format is not supported. Anything in the Properties format being imported will be treated as key value.");
    }
  }
}

/**
 * Normalizes a validated snake_case feature flag (Microsoft Feature Management or enhanced shape)
 * into a camelCase FeatureFlagParam. Accepts either `id` or `name`, and `client_filters` or `filters`.
 *
 * @internal
 * */
export function convertToFeatureFlagParam(rawFeatureFlag: Record<string, any>): FeatureFlagParam {
  const featureFlag: FeatureFlagParam = {
    name: rawFeatureFlag.name ?? rawFeatureFlag.id,
    enabled: rawFeatureFlag.enabled ?? false
  };

  if (rawFeatureFlag.description !== undefined) {
    featureFlag.description = rawFeatureFlag.description;
  }
  if (rawFeatureFlag.label !== undefined) {
    featureFlag.label = rawFeatureFlag.label;
  }
  if (rawFeatureFlag.conditions) {
    const conditions: FeatureFlagConditions = {};
    const filters = rawFeatureFlag.conditions.filters ?? rawFeatureFlag.conditions.client_filters;
    if (filters !== undefined) {
      conditions.filters = filters;
    }
    if (rawFeatureFlag.conditions.requirement_type !== undefined) {
      conditions.requirementType = rawFeatureFlag.conditions.requirement_type;
    }
    featureFlag.conditions = conditions;
  }
  if (rawFeatureFlag.variants) {
    featureFlag.variants = rawFeatureFlag.variants.map((variant: Record<string, any>) => normalizeVariant(variant));
  }
  if (rawFeatureFlag.allocation) {
    featureFlag.allocation = normalizeAllocation(rawFeatureFlag.allocation);
  }
  if (rawFeatureFlag.telemetry !== undefined) {
    featureFlag.telemetry = rawFeatureFlag.telemetry;
  }
  if (rawFeatureFlag.tags !== undefined) {
    featureFlag.tags = rawFeatureFlag.tags;
  }

  return featureFlag;
}

function normalizeVariant(variant: Record<string, any>): FeatureFlagVariant {
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

function normalizeAllocation(allocation: Record<string, any>): FeatureFlagAllocation {
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
