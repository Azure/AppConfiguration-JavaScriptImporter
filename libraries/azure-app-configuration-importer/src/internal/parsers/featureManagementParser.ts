// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AjvValidationError, ArgumentError } from "../../errors";
import { ConfigurationFormat } from "../../enums";
import { RequirementType } from "../../featureFlag";
import { SourceOptions } from "../../options";
import { Constants } from "../constants";
import { MsFeatureFlagValueSchema } from "../../MsFeatureFlagSchema";
import Ajv, { ErrorObject } from "ajv";

const msFmFeatureFlagValidator = new Ajv().compile(MsFeatureFlagValueSchema);

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

function checkFeatureManagementExist(configurations: object): void {
  const keys: string[] = Object.keys(configurations);
  for (const featureFlagKeyWord of Constants.FeatureManagementKeyWords) {
    if (keys.find(key => key.startsWith(featureFlagKeyWord))) {
      throw new ArgumentError("Importing feature flag in Properties format is not supported. Anything in the Properties format being imported will be treated as key value.");
    }
  }
}
