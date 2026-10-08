// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ListFeatureFlagsOptions } from "@azure/app-configuration";
import { ArgumentError } from "../../errors";
import { FeatureFlagChange } from "../../models";
import { FeatureFlagSource } from "./featureFlagSource";

/**
 * A FeatureFlagSource that wraps pre-calculated enhanced feature flag changes.
 *
 * Use this class to import changes that were previously obtained via GetFeatureFlagChanges().
 *
 * Example usage:
 * ```ts
 * const changes = await importer.GetFeatureFlagChanges(source);
 * const changesSource = new FeatureFlagChangesSource(changes);
 * await importer.Import(changesSource, { timeout: 60 });
 * ```
 */
export class FeatureFlagChangesSource implements FeatureFlagSource {
  /**
   * Initializes a source containing pre-calculated feature flag changes.
   *
   * @param changes - Changes previously returned by GetFeatureFlagChanges().
   * @param filterOptions - Filter options are not supported and must be omitted.
   */
  public constructor(private changes: FeatureFlagChange[], filterOptions?: ListFeatureFlagsOptions) {
    if (filterOptions && Object.keys(filterOptions).length > 0) {
      throw new ArgumentError("FeatureFlagFilterOptions are not supported for FeatureFlagChangesSource.");
    }
  }

  /**
   * @inheritdoc
   */
  public async GetFeatureFlags(): Promise<FeatureFlagChange[]> {
    return this.changes;
  }
}