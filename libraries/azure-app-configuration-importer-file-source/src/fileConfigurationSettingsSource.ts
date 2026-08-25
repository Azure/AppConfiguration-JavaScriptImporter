// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as fs from "fs";
import { SetConfigurationSettingParam, FeatureFlagValue, SecretReferenceValue } from "@azure/app-configuration";
import { FileSourceOptions, SourceOptions } from "./fileSourceOptions";
import { StringConfigurationSettingsSource, ArgumentNullError } from "@azure/app-configuration-importer";

/**
 * ConfigurationSettingsSource implementation of file configuration source
 */
export class FileConfigurationSettingsSource extends StringConfigurationSettingsSource {
  private filePath: string;

  constructor(fileOptions: FileSourceOptions) {
    super({
      data: "",
      ...fileOptions as SourceOptions
    });

    if (!fileOptions) {
      throw new ArgumentNullError("fileOptions argument is required.");
    }

    if (!fileOptions.filePath || fileOptions.filePath.trim().length <= 0) {
      throw new ArgumentNullError("fileOptions.filePath cannot be null or empty.");
    }

    this.filePath = fileOptions.filePath;
  }

  /**
   * @inheritdoc
   */
  public override async GetConfigurationSettings(): Promise<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[]> {
    try {
      const data = fs.readFileSync(this.filePath).toString();
      return super.getConfigurationSettingsInternal(data);
    }
    catch (error: any) {
      error.message = `Error while importing configuration settings from ${this.filePath}: ${error.message}`;
      throw error;
    }
  }
}