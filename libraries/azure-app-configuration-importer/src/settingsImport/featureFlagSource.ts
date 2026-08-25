// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlagParam, ListFeatureFlagsOptions } from "@azure/app-configuration";
import { FeatureFlagChange } from "../models";

/**
 * Interface of all FeatureFlagSource implementations.
 */
export interface FeatureFlagSource {
  /**
   * Get enhanced feature flags from the source.
   *
   * @returns Collection of FeatureFlagParam or FeatureFlagChange objects.
   */
  GetFeatureFlags(): Promise<FeatureFlagParam[] | FeatureFlagChange[]>;

  /**
   * Get name and label filters.
   *
   * @returns Name and label filters.
   */
  FeatureFlagFilterOptions?: ListFeatureFlagsOptions;
}