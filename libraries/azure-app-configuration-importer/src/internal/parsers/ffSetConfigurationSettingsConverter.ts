// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlagParam } from "@azure/app-configuration";
import { ArgumentError } from "../../errors";

const allowedProperties = new Set([
  "name", "label", "enabled", "description", "conditions", "variants",
  "allocation", "telemetry", "tags"
]);

/** Converts an appconfig/ffset document to enhanced feature flags. */
export class FfSetConfigurationSettingsConverter {
  public Convert(config: Record<string, unknown>): FeatureFlagParam[] {
    if (!Array.isArray(config.items)) {
      throw new ArgumentError("The input data doesn't follow the FFSet v1 schema. The 'items' property must be an array.");
    }

    return config.items.map((item, index) => this.convertItem(item, index));
  }

  private convertItem(item: unknown, index: number): FeatureFlagParam {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ArgumentError(`Feature flag at index ${index} must be an object.`);
    }

    const value = item as Record<string, unknown>;
    const unknownProperty = Object.keys(value).find(property => !allowedProperties.has(property));
    if (unknownProperty) {
      throw new ArgumentError(`Feature flag '${String(value.name ?? index)}' contains unsupported property '${unknownProperty}'.`);
    }
    if (typeof value.name !== "string" || value.name.length === 0) {
      throw new ArgumentError(`Feature flag at index ${index} must contain a non-empty string 'name'.`);
    }
    if (typeof value.enabled !== "boolean") {
      throw new ArgumentError(`Feature flag '${value.name}' must contain a boolean 'enabled'.`);
    }
    if (value.label !== undefined && typeof value.label !== "string") {
      throw new ArgumentError(`Feature flag '${value.name}' has an invalid label.`);
    }
    if (value.description !== undefined && typeof value.description !== "string") {
      throw new ArgumentError(`Feature flag '${value.name}' has an invalid description.`);
    }
    if (value.tags !== undefined && (!value.tags || typeof value.tags !== "object" || Array.isArray(value.tags) ||
      Object.values(value.tags).some(tag => typeof tag !== "string"))) {
      throw new ArgumentError(`Feature flag '${value.name}' has invalid tags.`);
    }
    this.validateConditions(value.name, value.conditions);
    this.validateVariants(value.name, value.variants);
    this.validateAllocation(value.name, value.allocation);
    this.validateTelemetry(value.name, value.telemetry);

    return value as unknown as FeatureFlagParam;
  }

  private validateConditions(name: string, conditions: unknown): void {
    if (conditions === undefined) {
      return;
    }
    if (!this.isRecord(conditions) || (conditions.requirementType !== undefined && typeof conditions.requirementType !== "string") ||
      (conditions.filters !== undefined && !Array.isArray(conditions.filters))) {
      throw new ArgumentError(`Feature flag '${name}' has invalid conditions.`);
    }
    for (const filter of conditions.filters ?? []) {
      if (!this.isRecord(filter) || typeof filter.name !== "string" ||
        (filter.parameters !== undefined && (!this.isRecord(filter.parameters) ||
          Object.values(filter.parameters).some(parameter => typeof parameter !== "string")))) {
        throw new ArgumentError(`Feature flag '${name}' has invalid conditions.`);
      }
    }
  }

  private validateVariants(name: string, variants: unknown): void {
    if (variants === undefined) {
      return;
    }
    if (!Array.isArray(variants) || variants.some(variant =>
      !this.isRecord(variant) || typeof variant.name !== "string" ||
      (variant.value !== undefined && typeof variant.value !== "string") ||
      (variant.contentType !== undefined && typeof variant.contentType !== "string") ||
      (variant.statusOverride !== undefined && typeof variant.statusOverride !== "string")
    )) {
      throw new ArgumentError(`Feature flag '${name}' has invalid variants.`);
    }
  }

  private validateAllocation(name: string, allocation: unknown): void {
    if (allocation === undefined) {
      return;
    }
    if (!this.isRecord(allocation) ||
      !this.isOptionalString(allocation.defaultWhenEnabled) ||
      !this.isOptionalString(allocation.defaultWhenDisabled) ||
      !this.isOptionalString(allocation.seed) ||
      !this.isAllocationArray(allocation.percentile, ["variant", "from", "to"], ["from", "to"]) ||
      !this.isAllocationArray(allocation.user, ["variant", "users"]) ||
      !this.isAllocationArray(allocation.group, ["variant", "groups"])) {
      throw new ArgumentError(`Feature flag '${name}' has invalid allocation.`);
    }
  }

  private validateTelemetry(name: string, telemetry: unknown): void {
    if (telemetry === undefined) {
      return;
    }
    if (!this.isRecord(telemetry) || typeof telemetry.enabled !== "boolean" ||
      (telemetry.metadata !== undefined && (!this.isRecord(telemetry.metadata) ||
        Object.values(telemetry.metadata).some(metadata => typeof metadata !== "string")))) {
      throw new ArgumentError(`Feature flag '${name}' has invalid telemetry.`);
    }
  }

  private isAllocationArray(value: unknown, required: string[], numeric: string[] = []): boolean {
    if (value === undefined) {
      return true;
    }
    return Array.isArray(value) && value.every(item => this.isRecord(item) && required.every(property => {
      if (!(property in item)) {
        return false;
      }
      if (numeric.includes(property)) {
        return typeof item[property] === "number";
      }
      if (property === "users" || property === "groups") {
        return Array.isArray(item[property]) && (item[property] as unknown[]).every(entry => typeof entry === "string");
      }
      return typeof item[property] === "string";
    }));
  }

  private isOptionalString(value: unknown): boolean {
    return value === undefined || typeof value === "string";
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
}
