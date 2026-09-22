// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlagParam } from "@azure/app-configuration";
import { ArgumentError } from "../../errors";
import { convertToFeatureFlagParam, validateMsFmEnhancedFeatureFlagSchema } from "./featureManagementParser";
import { FeatureFlagParamConverter } from "./featureFlagParamConverter";

/**
 * Format Parser for ffset profile.
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
    const items: Array<Record<string, unknown>> = config[itemsKeyword as keyof object];
    for (let index = 0; index < items.length; index++) {
      const element = items[index];
      validateMsFmEnhancedFeatureFlagSchema(element, index);
      featureFlags.push(convertToFeatureFlagParam(element));
    }

    return featureFlags;
  }
}
