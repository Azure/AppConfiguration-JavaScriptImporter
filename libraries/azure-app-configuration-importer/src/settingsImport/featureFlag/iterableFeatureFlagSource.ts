// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlag, FeatureFlagParam, ListFeatureFlagPage, ListFeatureFlagsOptions } from "@azure/app-configuration";
import { PagedAsyncIterableIterator, PageSettings } from "@azure/core-paging";
import { ArgumentError } from "../../errors";
import { IterableFeatureFlagSourceOptions } from "../../options";
import { FeatureFlagSource } from "./featureFlagSource";

/**
 * A FeatureFlagSource that reads enhanced feature flags from an SDK paged iterator.
 */
export class IterableFeatureFlagSource implements FeatureFlagSource {
  public FeatureFlagFilterOptions: ListFeatureFlagsOptions = {};
  private data: PagedAsyncIterableIterator<FeatureFlag, ListFeatureFlagPage, PageSettings>;
  private options: IterableFeatureFlagSourceOptions;

  /**
   * Initializes a feature flag source backed by an SDK paged iterator.
   *
   * @param options - Source data and feature flag filter options.
   */
  public constructor(options: IterableFeatureFlagSourceOptions) {
    this.data = options.data;
    this.options = options;
    this.FeatureFlagFilterOptions = {
      nameFilter: options.prefix ? options.prefix + "*" : undefined,
      labelFilter: options.label ? options.label : "\0"
    };
  }

  /**
   * @inheritdoc
   */
  public async GetFeatureFlags(): Promise<FeatureFlagParam[]> {
    const featureFlags: FeatureFlagParam[] = [];
    for await (const featureFlag of this.data) {
      let generatedName = featureFlag.name;
      if (this.options.trimPrefix && generatedName.startsWith(this.options.trimPrefix)) {
        generatedName = generatedName.substring(this.options.trimPrefix.length);
      }
      if (this.options.prefix) {
        generatedName = this.options.prefix + generatedName;
      }
      if (generatedName === "." || generatedName === ".." || generatedName.includes("%")) {
        throw new ArgumentError("Feature flag name cannot be a '.' or '..', or contain the '%' character.");
      }

      featureFlags.push({
        ...featureFlag,
        name: generatedName,
        label: this.options.label || featureFlag.label
      });
    }
    return featureFlags;
  }
}