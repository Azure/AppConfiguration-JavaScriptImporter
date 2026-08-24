// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlagParam, ListFeatureFlagsOptions } from "@azure/app-configuration";
import { IterableFeatureFlagSourceOptions } from "../options";
import { FeatureFlagSource } from "./featureFlagSource";

/** Adapts an SDK feature flag iterator for enhanced feature flag import. */
export class IterableFeatureFlagSource implements FeatureFlagSource {
  public FeatureFlagFilterOptions: ListFeatureFlagsOptions = {};

  public constructor(private options: IterableFeatureFlagSourceOptions) {}

  public async GetFeatureFlags(): Promise<FeatureFlagParam[]> {
    const featureFlags: FeatureFlagParam[] = [];
    for await (const featureFlag of this.options.data) {
      featureFlags.push(featureFlag);
    }
    return featureFlags;
  }
}