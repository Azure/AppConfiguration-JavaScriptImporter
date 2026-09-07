// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlagParam } from "@azure/app-configuration";
import { ArgumentError } from "../../errors";
import { FfSetItem } from "../../models";

const allowedProperties = new Set([
  "name", "label", "enabled", "description", "conditions", "variants",
  "allocation", "telemetry", "tags"
]);

/**
 * Format Parser for ffset profile.
 *
 * @internal
 * */
export class FfSetConfigurationSettingsConverter {
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
      const element = items[index];
      this.validateFfSetElement(element, index);
      featureFlags.push(element);
    }

    return featureFlags;
  }

  private validateFfSetElement(element: FfSetItem, index: number) {
    const unknownProperty = Object.keys(element).find(property => !allowedProperties.has(property));
    if (unknownProperty) {
      throw new ArgumentError(`Feature flag '${String(element.name ?? index)}' contains unsupported property '${unknownProperty}'.`);
    }
    if (typeof element.name !== "string" || element.name.length === 0) {
      throw new ArgumentError(`Feature flag at index ${index} must contain a non-empty string 'name'.`);
    }
    if (typeof element.enabled !== "boolean") {
      throw new ArgumentError(`Feature flag '${element.name}' must contain a boolean 'enabled'.`);
    }
    if (element.label !== undefined && typeof element.label !== "string") {
      throw new ArgumentError(`Feature flag '${element.name}' has an invalid label.`);
    }
    if (element.description !== undefined && typeof element.description !== "string") {
      throw new ArgumentError(`Feature flag '${element.name}' has an invalid description.`);
    }
    if (element.tags !== undefined && (!element.tags || typeof element.tags !== "object" || Array.isArray(element.tags) ||
      Object.values(element.tags).some(tag => typeof tag !== "string"))) {
      throw new ArgumentError(`Feature flag '${element.name}' has invalid tags.`);
    }
    this.validateConditions(element.name, element.conditions);
    this.validateVariants(element.name, element.variants);
    this.validateAllocation(element.name, element.allocation);
    this.validateTelemetry(element.name, element.telemetry);
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
