// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { 
  ConfigurationSetting, 
  SetConfigurationSettingParam, 
  FeatureFlagValue,
  featureFlagContentType,
  SecretReferenceValue } from "@azure/app-configuration";
import { isEmpty, isEqual } from "lodash";
import { Tags, FeatureFlagClientFilters } from "../models";
import { SourceOptions } from "../importOptions";
import { ConfigurationFormat, ConfigurationProfile } from "../enums";
import { ArgumentError, ArgumentNullError } from "../errors";
import { Constants } from "../internal/constants";
import { MsFeatureFlagValue, Variant } from "../featureFlag";

/** @internal*/
export function isJsonContentType(contentType?: string): boolean {
  if (!contentType) {
    return false;
  }

  contentType = contentType.trim().toLowerCase();
  const mineType = contentType.split(";")[0].trim();
  const typeParts = mineType.split("/");
  if (typeParts.length != 2) {
    return false;
  }

  if (typeParts[0] != "application") {
    return false;
  }

  const subTypes = typeParts[1].split("+");
  if (subTypes[subTypes.length-1] == "json") {
    return true;
  }

  return false;
}

/** @internal*/
export function isConfigSettingEqual(settingA: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>, settingB: ConfigurationSetting) {
  let valueIsEqual: boolean = settingA.value == settingB.value;
  
  if (settingA.contentType == featureFlagContentType &&
    settingB.contentType == featureFlagContentType && 
    settingA.value !== undefined && 
    settingB.value !== undefined) {
    valueIsEqual = isFeatureFlagValueEqual(settingA.value as string | FeatureFlagValue, settingB.value);
  }

  return valueIsEqual &&
    settingA.contentType == settingB.contentType &&
    areTagsEqual(settingA.tags, settingB.tags);
}

/** @internal*/
export function areTagsEqual(tagA?: Tags, tagB?: Tags): boolean {
  if (isEmpty(tagA) || isEmpty(tagB)) {
    return isEmpty(tagA) && isEmpty(tagB);
  }

  if (Object.keys(tagA).length !== Object.keys(tagB).length) {
    return false;
  }

  for(const key in tagA) {
    if (tagA[key] !== tagB[key]) {
      return false;
    }
  }
  return true;
}

/** @internal*/
/**
 * Validate the ConfigurationSyncOptions argument, throw fatal error if options are not valid.
 *
 * @param options - ConfigurationSyncOptions to be validated.
 */
export function validateOptions(options: SourceOptions): void {
  if (!options) {
    throw new ArgumentNullError();
  }

  if (options.profile == ConfigurationProfile.KvSet) {
    if (
      options.prefix ||
      options.separator ||
      options.label ||
      options.depth ||
      options.tags ||
      options.contentType
    ) {
      throw new ArgumentError(
        "The option label, prefix, depth, contentType, tags and separator are not supported when importing using 'appconfig/kvset' profile"
      );
    }

    if (options.format !== ConfigurationFormat.Json) {
      throw new ArgumentError(
        "Yaml and Properties formats are not supported for appconfig/kvset profile. Supported value is: Json"
      );
    }
  }

  if (options.depth && options.depth > 1 && !options.separator) {
    throw new ArgumentError(
      "Separator must be specified if Depth is default value or set a value lager than 1"
    );
  }

  if (options.separator && !Constants.Separators.includes(options.separator)) {
    throw new ArgumentError(`${options.separator} is not a supported separator.`);
  }

  if (!options.separator && !options.depth) {
    options.depth = 1;
  }

  if (options.format !== ConfigurationFormat.Json && isJsonContentType(options.contentType)) {
    throw new ArgumentError(`Failed to import '${ConfigurationFormat[options.format]}' data format with '${options.contentType}' content type. Please provide data in JSON format to match your content type.`);
  }
}

function isFeatureFlagValueEqual(valueA: string | MsFeatureFlagValue, valueB: string): boolean {
  let featureFlagAValue: MsFeatureFlagValue;

  if (typeof valueA == "string") {
    featureFlagAValue = toMsFeatureFlagValue(valueA);
  }
  else {
    featureFlagAValue = valueA as MsFeatureFlagValue;
  }

  const featureFlagBValue: MsFeatureFlagValue = toMsFeatureFlagValue(valueB);

  if (Object.keys(featureFlagAValue).length !== Object.keys(featureFlagBValue).length) {
    return false;
  }

  return featureFlagAValue.id == featureFlagBValue.id &&
    featureFlagAValue.enabled == featureFlagBValue.enabled &&
    featureFlagAValue.description == featureFlagBValue.description &&
    areArrayEqual<FeatureFlagClientFilters>(featureFlagAValue.conditions.clientFilters, featureFlagBValue.conditions.clientFilters) &&
    isEqual(featureFlagAValue.allocation, featureFlagBValue.allocation) &&
    areArrayEqual<Variant>(featureFlagAValue.variants ?? [], featureFlagBValue.variants ?? []) &&
    isEqual(featureFlagAValue.telemetry, featureFlagBValue.telemetry);
}

function areArrayEqual<T>(arrayA: T[], arrayB: T[]): boolean {
  if (arrayA.length !== arrayB.length) {
    return false;
  }

  for (let i = 0; i < arrayA.length; i++) {
    if (!isEqual(arrayA[i], arrayB[i])) {
      return false;
    }
  }
  return true;
}

function toMsFeatureFlagValue(value: string): MsFeatureFlagValue {
  const parsedJson: any = JSON.parse(value);

  const msFeatureFlagValue: MsFeatureFlagValue = {
    id: parsedJson.id,
    enabled: parsedJson.enabled,
    description:parsedJson.description,
    conditions: isEmpty(parsedJson.conditions) ? {clientFilters: []} : {clientFilters: parsedJson.conditions.client_filters}
  };
  
  if (parsedJson.allocation) {
    msFeatureFlagValue.allocation = parsedJson.allocation;
  }

  if (parsedJson.variants) {
    msFeatureFlagValue.variants = parsedJson.variants;
  }

  if (parsedJson.telemetry) {
    msFeatureFlagValue.telemetry = parsedJson.telemetry;
  }

  return msFeatureFlagValue;
}

export function serializeFeatureFlagValue(featureFlagValue: MsFeatureFlagValue): string {
  if (!featureFlagValue) {
    throw new TypeError("Invalid feature flag value");
  }

  const jsonFeatureFlagValue: any = {
    id: featureFlagValue.id,
    enabled: featureFlagValue.enabled,
    description: featureFlagValue.description,
    conditions: {
      client_filters: featureFlagValue.conditions?.clientFilters
    },
    display_name: featureFlagValue.displayName
  };

  if (featureFlagValue.conditions && featureFlagValue.conditions.requirementType) {
    jsonFeatureFlagValue.conditions.requirement_type = featureFlagValue.conditions.requirementType;
  }

  if (featureFlagValue.allocation) {
    jsonFeatureFlagValue.allocation = featureFlagValue.allocation;
  }

  if (featureFlagValue.variants) {
    jsonFeatureFlagValue.variants = featureFlagValue.variants;
  }

  if (featureFlagValue.telemetry) {
    jsonFeatureFlagValue.telemetry = featureFlagValue.telemetry;
  }

  return JSON.stringify(jsonFeatureFlagValue);
}
