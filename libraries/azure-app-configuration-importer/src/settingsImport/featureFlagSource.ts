// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlagParam, ListFeatureFlagsOptions } from "@azure/app-configuration";
import { FeatureFlagChange } from "../models";

/** Interface for enhanced feature flag import sources. */
export interface FeatureFlagSource {
  GetFeatureFlags(): Promise<FeatureFlagParam[] | FeatureFlagChange[]>;
  FeatureFlagFilterOptions?: ListFeatureFlagsOptions;
}