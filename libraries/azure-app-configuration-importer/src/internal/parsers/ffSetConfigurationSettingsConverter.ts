// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  FeatureFlagAllocation,
  FeatureFlagConditions,
  FeatureFlagParam,
  FeatureFlagVariantDefinition
} from "@azure/app-configuration";
import { ArgumentError } from "../../errors";
import { FfSetItem } from "../../models";
import { FeatureFlagParamConverter } from "./featureFlagParamConverter";

const allowedProperties = new Set([
  "name", "label", "enabled", "description", "conditions", "variants", "allocation", "telemetry", "tags"
]);

/**
 * Format Parser for ffset profile.
 *
 * FFSet items are authored directly in the enhanced (snake_case) feature flag shape. Each item is
 * validated inline and transformed into FeatureFlagParam. This path is independent of the
 * default-profile converter.
 *
 * @internal
 * */
export class FfSetConfigurationSettingsConverter implements FeatureFlagParamConverter {
  /**
   * @inheritdoc
   * */
  public Convert(config: object): FeatureFlagParam[] {
    const featureFlags = new Array<FeatureFlagParam>();
    const itemsKeyword = "items";

    if (!(itemsKeyword in config) || !Array.isArray(config[itemsKeyword as keyof object])) {
      throw new ArgumentError("The input data doesn't follow the FFSet file schema. See https://azconfig.io/schemas/FFSet/v1.0.0/FFSet.json");
    }
    const items: Array<FfSetItem> = config[itemsKeyword as keyof object];
    for (let index = 0; index < items.length; index++) {
      featureFlags.push(this.convertItemToFeatureFlagParam(items[index], index));
    }

    return featureFlags;
  }

  private convertItemToFeatureFlagParam(item: FfSetItem, index: number): FeatureFlagParam {
    const unknownProperty = Object.keys(item).find(property => !allowedProperties.has(property));
    if (unknownProperty) {
      throw new ArgumentError(`Feature flag '${String(item.name ?? index)}' contains unsupported property '${unknownProperty}'.`);
    }
    if (typeof item.name !== "string" || item.name.length === 0) {
      throw new ArgumentError(`Feature flag at index ${index} must contain a non-empty string 'name'.`);
    }
    if (typeof item.enabled !== "boolean") {
      throw new ArgumentError(`Feature flag '${item.name}' must contain a boolean 'enabled'.`);
    }

    const featureFlag: FeatureFlagParam = { name: item.name, enabled: item.enabled };

    if (item.description !== undefined) {
      featureFlag.description = this.readString(item.name, "description", item.description);
    }
    if (item.label !== undefined) {
      featureFlag.label = this.readString(item.name, "label", item.label);
    }
    if (item.conditions !== undefined) {
      featureFlag.conditions = this.readConditions(item.name, item.conditions);
    }
    if (item.variants !== undefined) {
      featureFlag.variants = this.readVariants(item.name, item.variants);
    }
    if (item.allocation !== undefined) {
      featureFlag.allocation = this.readAllocation(item.name, item.allocation);
    }
    if (item.telemetry !== undefined) {
      featureFlag.telemetry = this.readTelemetry(item.name, item.telemetry);
    }
    if (item.tags !== undefined) {
      featureFlag.tags = this.readStringMap(item.name, "tags", item.tags);
    }

    return featureFlag;
  }

  private readConditions(name: string, conditions: unknown): FeatureFlagConditions {
    if (!this.isObject(conditions)) {
      throw new ArgumentError(`Feature flag '${name}' has invalid 'conditions'.`);
    }
    const result: FeatureFlagConditions = {};
    if (conditions.requirement_type !== undefined) {
      result.requirementType = this.readString(name, "requirement_type", conditions.requirement_type);
    }
    if (conditions.filters !== undefined) {
      if (!Array.isArray(conditions.filters)) {
        throw new ArgumentError(`Feature flag '${name}' has invalid 'filters'.`);
      }
      result.filters = conditions.filters.map((filter: unknown) => {
        if (!this.isObject(filter) || typeof filter.name !== "string") {
          throw new ArgumentError(`Feature flag '${name}' has an invalid filter.`);
        }
        return filter.parameters !== undefined
          ? { name: filter.name, parameters: this.readStringMap(name, "parameters", filter.parameters) }
          : { name: filter.name };
      });
    }
    return result;
  }

  private readVariants(name: string, variants: unknown): FeatureFlagVariantDefinition[] {
    if (!Array.isArray(variants)) {
      throw new ArgumentError(`Feature flag '${name}' has invalid 'variants'.`);
    }
    return variants.map((variant: unknown) => {
      if (!this.isObject(variant) || typeof variant.name !== "string") {
        throw new ArgumentError(`Feature flag '${name}' has an invalid variant.`);
      }
      const result: FeatureFlagVariantDefinition = { name: variant.name };
      if (variant.value !== undefined) {
        result.value = this.readString(name, "value", variant.value);
      }
      if (variant.content_type !== undefined) {
        result.contentType = this.readString(name, "content_type", variant.content_type);
      }
      if (variant.status_override !== undefined) {
        result.statusOverride = this.readString(name, "status_override", variant.status_override);
      }
      return result;
    });
  }

  private readAllocation(name: string, allocation: unknown): FeatureFlagAllocation {
    if (!this.isObject(allocation)) {
      throw new ArgumentError(`Feature flag '${name}' has invalid 'allocation'.`);
    }
    const result: FeatureFlagAllocation = {};
    if (allocation.seed !== undefined) {
      result.seed = this.readString(name, "seed", allocation.seed);
    }
    if (allocation.default_when_enabled !== undefined) {
      result.defaultWhenEnabled = this.readString(name, "default_when_enabled", allocation.default_when_enabled);
    }
    if (allocation.default_when_disabled !== undefined) {
      result.defaultWhenDisabled = this.readString(name, "default_when_disabled", allocation.default_when_disabled);
    }
    if (allocation.percentile !== undefined) {
      result.percentile = this.readAllocationList(name, allocation.percentile, ["variant", "from", "to"], ["from", "to"]) as NonNullable<FeatureFlagAllocation["percentile"]>;
    }
    if (allocation.user !== undefined) {
      result.user = this.readAllocationList(name, allocation.user, ["variant", "users"]) as NonNullable<FeatureFlagAllocation["user"]>;
    }
    if (allocation.group !== undefined) {
      result.group = this.readAllocationList(name, allocation.group, ["variant", "groups"]) as NonNullable<FeatureFlagAllocation["group"]>;
    }
    return result;
  }

  private readTelemetry(name: string, telemetry: unknown): NonNullable<FeatureFlagParam["telemetry"]> {
    if (!this.isObject(telemetry) || typeof telemetry.enabled !== "boolean") {
      throw new ArgumentError(`Feature flag '${name}' has invalid 'telemetry'.`);
    }
    const result: NonNullable<FeatureFlagParam["telemetry"]> = { enabled: telemetry.enabled };
    if (telemetry.metadata !== undefined) {
      result.metadata = this.readStringMap(name, "metadata", telemetry.metadata);
    }
    return result;
  }

  private readAllocationList(name: string, value: unknown, required: string[], numeric: string[] = []): unknown[] {
    if (!Array.isArray(value) || value.some((item: unknown) => !this.isObject(item) || required.some(property => {
      const field = item[property];
      if (field === undefined) {
        return true;
      }
      if (numeric.includes(property)) {
        return typeof field !== "number";
      }
      if (property === "users" || property === "groups") {
        return !Array.isArray(field) || field.some((entry: unknown) => typeof entry !== "string");
      }
      return typeof field !== "string";
    }))) {
      throw new ArgumentError(`Feature flag '${name}' has invalid 'allocation'.`);
    }
    return value;
  }

  private readString(name: string, field: string, value: unknown): string {
    if (typeof value !== "string") {
      throw new ArgumentError(`Feature flag '${name}' has an invalid '${field}'.`);
    }
    return value;
  }

  private readStringMap(name: string, field: string, value: unknown): { [propertyName: string]: string } {
    if (!this.isObject(value) || Object.values(value).some(entry => typeof entry !== "string")) {
      throw new ArgumentError(`Feature flag '${name}' has invalid '${field}'.`);
    }
    return value as { [propertyName: string]: string };
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
}
