// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { 
  ConfigurationSetting, 
  FeatureFlag,
  FeatureFlagParam,
  SetConfigurationSettingParam, 
  FeatureFlagValue,
  featureFlagContentType,
  SecretReferenceValue } from "@azure/app-configuration";
import { OperationOptions } from "@azure/core-client";
import { isEmpty, isEqual } from "lodash";
import { v4 as uuidv4 } from "uuid";
import { Tags, FeatureFlagClientFilters, ConfigurationSettingsFields, ConfigurationSettingChange, FeatureFlagChange } from "../models";
import { ChangeType } from "../enums";
import { Constants } from "../internal/constants";
import { MsFeatureFlagValue, Variant } from "../featureFlag";

/** @internal */
export function createCorrelationOptions(): OperationOptions {
  return {
    requestOptions: {
      customHeaders: { [Constants.CorrelationRequestIdHeader]: uuidv4() }
    }
  };
}

/** @internal */
export function isChangeArray(value: unknown): value is (ConfigurationSettingChange | FeatureFlagChange)[] {
  return Array.isArray(value) && value.every(item => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const change = item as Record<string, unknown>;
    return "changeType" in change &&
      "currentValue" in change &&
      "newValue" in change &&
      Object.values(ChangeType).includes(change.changeType as ChangeType);
  });
}

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
export function isConfigSettingEqual(settingA: SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>, settingB: ConfigurationSetting, supportedFields: ConfigurationSettingsFields): boolean {
 
  if ((supportedFields & ConfigurationSettingsFields.Value) === ConfigurationSettingsFields.Value) {
    let valueIsEqual: boolean = settingA.value == settingB.value;

    if (settingA.contentType == featureFlagContentType &&
      settingB.contentType == featureFlagContentType &&
      settingA.value !== undefined &&
      settingB.value !== undefined) {
      valueIsEqual = isFeatureFlagValueEqual(settingA.value as string | MsFeatureFlagValue, settingB.value);
    }

    if (!valueIsEqual) {
      return false;
    }
  }

  if ((supportedFields & ConfigurationSettingsFields.ContentType) === ConfigurationSettingsFields.ContentType && settingA.contentType != settingB.contentType) {
    return false;
  }

  if ((supportedFields & ConfigurationSettingsFields.Tags) === ConfigurationSettingsFields.Tags && !areTagsEqual(settingA.tags, settingB.tags)) {
    return false;
  }

  if ((supportedFields & ConfigurationSettingsFields.Description) === ConfigurationSettingsFields.Description  && settingA.description != settingB.description) {
    return false;
  }

  return true;
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

/** @internal */
export function isEnhancedFeatureFlagEqual(incoming: FeatureFlagParam, existing: FeatureFlag): boolean {
  return incoming.name === existing.name &&
    (incoming.label ?? "") === (existing.label ?? "") &&
    incoming.enabled === existing.enabled &&
    incoming.description === existing.description &&
    isEqual(normalizeEnhancedConditions(incoming.conditions), normalizeEnhancedConditions(existing.conditions)) &&
    isEqual(incoming.variants, existing.variants) &&
    isEqual(incoming.allocation, existing.allocation) &&
    isEqual(incoming.telemetry, existing.telemetry) &&
    areTagsEqual(incoming.tags, existing.tags);
}

function normalizeEnhancedConditions(conditions: FeatureFlagParam["conditions"]): FeatureFlagParam["conditions"] {
  if (!conditions?.requirementType && (!conditions?.filters || conditions.filters.length === 0)) {
    return undefined;
  }
  return conditions;
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
