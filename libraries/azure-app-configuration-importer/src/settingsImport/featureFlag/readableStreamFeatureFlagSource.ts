// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FeatureFlagParam, ListFeatureFlagsOptions } from "@azure/app-configuration";
import { toWebStream } from "../../internal/stream";
import { ReadableStreamSourceOptions, SourceOptions } from "../../options";
import { StringFeatureFlagSource } from "./stringFeatureFlagSource";
import { FeatureFlagSource } from "./featureFlagSource";

/**
 * A FeatureFlagSource that reads enhanced feature flags from a readable stream.
 */
export class ReadableStreamFeatureFlagSource implements FeatureFlagSource {
  public FeatureFlagFilterOptions: ListFeatureFlagsOptions = {};
  private options: SourceOptions;
  private data: ReadableStream<Uint8Array> | NodeJS.ReadableStream;
  private depthWasSpecified: boolean;

  /**
   * Initializes a feature flag source backed by a web or Node.js readable stream.
   *
   * @param options - Stream data, format, profile, and transformation options.
   */
  constructor(options: ReadableStreamSourceOptions) {
    this.depthWasSpecified = options && options.depth !== undefined;
    this.options = options;
    this.data = options.data;

    // Validate the options eagerly and seed the initial filter options.
    const validationSource = new StringFeatureFlagSource({ ...this.options, data: "" });
    this.FeatureFlagFilterOptions = validationSource.FeatureFlagFilterOptions;
  }

  /**
   * @inheritdoc
   */
  public async GetFeatureFlags(): Promise<FeatureFlagParam[]> {
    const stringSource = new StringFeatureFlagSource({
      ...this.options,
      depth: this.depthWasSpecified ? this.options.depth : undefined,
      data: await this.readAllData()
    });
    const featureFlags = await stringSource.GetFeatureFlags();
    this.FeatureFlagFilterOptions = stringSource.FeatureFlagFilterOptions;
    return featureFlags;
  }

  private async readAllData(): Promise<string> {
    const reader: ReadableStreamDefaultReader = toWebStream(this.data).getReader();
    const textDecoder = new TextDecoder("utf-8");

    try {
      let allData = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          return allData;
        }

        if (value) {
          allData += textDecoder.decode(value);
        }
      }
    }
    finally {
      reader.releaseLock();
    }
  }
}
