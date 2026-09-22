// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlagParam } from "@azure/app-configuration";
import { SourceOptions } from "../../options";

/**
 * FeatureFlagParam converter for different feature flag content.
 *
 * @internal
 * */
export interface FeatureFlagParamConverter {
  Convert(rawConfig: object, options?: SourceOptions): FeatureFlagParam[];
}
