// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as fs from "fs";
import { FeatureFlagParam, ListFeatureFlagsOptions } from "@azure/app-configuration";
import { FileSourceOptions, SourceOptions } from "./fileSourceOptions";
import { FeatureFlagSource, StringFeatureFlagSource, ArgumentNullError } from "@azure/app-configuration-importer";

/**
 * FeatureFlagSource implementation of file feature flag source
 */
export class FileFeatureFlagSource implements FeatureFlagSource {
  public FeatureFlagFilterOptions: ListFeatureFlagsOptions = {};
  private fileOptions: FileSourceOptions;
  private filePath: string;

  constructor(fileOptions: FileSourceOptions) {
    if (!fileOptions) {
      throw new ArgumentNullError("fileOptions argument is required.");
    }

    if (!fileOptions.filePath || fileOptions.filePath.trim().length <= 0) {
      throw new ArgumentNullError("fileOptions.filePath cannot be null or empty.");
    }

    this.fileOptions = fileOptions;
    this.filePath = fileOptions.filePath;

    // Validate the options eagerly and seed the initial filter options.
    const validationSource = new StringFeatureFlagSource({ data: "", ...fileOptions as SourceOptions });
    this.FeatureFlagFilterOptions = validationSource.FeatureFlagFilterOptions;
  }

  /**
   * @inheritdoc
   */
  public async GetFeatureFlags(): Promise<FeatureFlagParam[]> {
    try {
      const data = fs.readFileSync(this.filePath).toString();
      const source = new StringFeatureFlagSource({ ...this.fileOptions as SourceOptions, data });
      const featureFlags = await source.GetFeatureFlags();
      this.FeatureFlagFilterOptions = source.FeatureFlagFilterOptions;
      return featureFlags;
    }
    catch (error: any) {
      error.message = `Error while importing enhanced feature flags from ${this.filePath}: ${error.message}`;
      throw error;
    }
  }
}
