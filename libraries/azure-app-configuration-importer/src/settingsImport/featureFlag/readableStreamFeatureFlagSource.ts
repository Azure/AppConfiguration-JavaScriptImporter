// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FeatureFlagParam, ListFeatureFlagsOptions } from "@azure/app-configuration";
import { toWebStream } from "../../internal/stream";
import { ReadableStreamSourceOptions, SourceOptions } from "../../options";
import { StringFeatureFlagSource } from "./stringFeatureFlagSource";
import { FeatureFlagSource } from "./featureFlagSource";
import { ConfigurationProfile } from "../../enums";
import { ArgumentError } from "../../errors";
import { validateOptions } from "../../internal/utils";

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
    if (options.profile === ConfigurationProfile.KvSet) {
      throw new ArgumentError("The appconfig/kvset profile is not supported by ReadableStreamFeatureFlagSource.");
    }
    this.depthWasSpecified = options && options.depth !== undefined;
    validateOptions(options);
    this.options = options;
    this.data = options.data;

    if (options.profile == ConfigurationProfile.FfSet) {
      this.FeatureFlagFilterOptions = {
        nameFilter: "*",
        labelFilter: "*"
      };
    }
    else {
      this.FeatureFlagFilterOptions = {
        nameFilter: options.prefix ? options.prefix + "*" : undefined,
        labelFilter: options.label ? options.label : "\0"
      };
    }
  }


  /**
   * @inheritdoc
   */
  public async GetFeatureFlags(): Promise<FeatureFlagParam[]> {
    const stringSource = this.createStringSource(await this.readAllData());
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

  private createStringSource(data: string): StringFeatureFlagSource {
    return new StringFeatureFlagSource({
      ...this.options,
      depth: this.depthWasSpecified ? this.options.depth : undefined,
      data
    });
  }
}
