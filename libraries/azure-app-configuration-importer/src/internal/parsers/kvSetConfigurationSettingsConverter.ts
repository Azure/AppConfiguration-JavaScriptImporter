// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  SetConfigurationSettingParam,
  FeatureFlagValue,
  SecretReferenceValue,
  featureFlagPrefix,
  featureFlagContentType
} from "@azure/app-configuration";
import { ArgumentError } from "../../errors";
import { KvSetConfigurationItem } from "../../models";
import { ConfigurationSettingsConverter } from "./configurationSettingsConverter";

/**
 * Format Parser for kvset profile.
 *
 * @internal
 * */
export class KvSetConfigurationSettingsConverter implements ConfigurationSettingsConverter {
  /**
   * @inheritdoc
   * */
  public Convert(config: object): SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[] {
    const configurationSettings = new Array<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>>();
    const itemsKeyword = "items";

    if (!(itemsKeyword in config) || !Array.isArray(config[itemsKeyword as keyof object])) {
      throw new ArgumentError("The input data doesn't follow the KVSet file schema. See https://github.com/Azure/AppConfiguration/blob/main/docs/KVSet/KVSet.v1.0.0.schema.json");
    }
    const items: Array<KvSetConfigurationItem> = config[itemsKeyword as keyof object];
    for (let index = 0; index < items.length; index++) {
      const element = items[index];
      this.validateKvSetElement(element);
      configurationSettings.push({
        key: element.key,
        value: element.value,
        label: element.label,
        contentType: element.content_type,
        tags: element.tags
      });
    }

    return configurationSettings;
  }

  private validateKvSetElement(element: KvSetConfigurationItem) {
    if (!element.key) {
      throw new ArgumentError("Configuration key is required, cannot be an empty string");
    }
    if (typeof element.key !== "string") {
      throw new ArgumentError(`Invalid key '${element.key}', key must be a string`);
    }
    if (element.key === "." || element.key === ".." || element.key.indexOf("%") > -1) {
      throw new ArgumentError("Key cannot be a '.' or '..', or contain the '%' character.");
    }
    if (element.key.startsWith(featureFlagPrefix) && element.content_type !== featureFlagContentType) {
      throw new ArgumentError(`Invalid key '${element.key}'. Key cannot start with the reserved prefix for feature flags.`);
    }
    if (element.value && typeof element.value !== "string") {
      throw new ArgumentError(`The 'value' for the key '${element.key}' is not a string.`);
    }
    if (element.content_type && typeof element.content_type !== "string") {
      throw new ArgumentError(`The 'content_type' for the key '${element.key}' is not a string.`);
    }
    if (element.label && typeof element.label !== "string") {
      throw new ArgumentError(`The 'label' for the key '${element.key}' is not a string.`);
    }
    if (typeof element.tags !== "object") {
      throw new ArgumentError(`The value for the tag '${element.tags}' for key '${element.key}' is not in a valid format.`);
    }
    for (const item in element.tags) {
      if (typeof element.tags[item] !== "string") {
        throw new ArgumentError(`The value for the tag '${element.tags}' for key '${element.key}' is not in a valid format.`);
      }
    }
  }
}
