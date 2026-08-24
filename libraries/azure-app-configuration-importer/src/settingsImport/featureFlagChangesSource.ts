// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlagChange } from "../models";
import { FeatureFlagSource } from "./featureFlagSource";

/** Wraps precomputed enhanced feature flag changes. */
export class FeatureFlagChangesSource implements FeatureFlagSource {
  public constructor(private changes: FeatureFlagChange[]) {}

  public async GetFeatureFlags(): Promise<FeatureFlagChange[]> {
    return this.changes;
  }
}