// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  SetConfigurationSettingParam,
  FeatureFlagValue,
  SecretReferenceValue
} from "@azure/app-configuration";
import { SourceOptions } from "../../importOptions";

/**
 * ConfigurationSettings converter for different configuration content.
 *
 * @internal
 * */
export interface ConfigurationSettingsConverter {
  Convert(
    rawConfig: object,
    options?: SourceOptions
  ): Array<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>>;
}
