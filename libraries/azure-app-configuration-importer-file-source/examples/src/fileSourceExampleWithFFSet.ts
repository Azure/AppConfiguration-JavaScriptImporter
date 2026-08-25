// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * @summary Demonstrates importing enhanced feature flags from a File source
*/
import path from "path";
import { FeatureFlagClient } from "@azure/app-configuration";
import { FeatureFlagImporter, ConfigurationFormat, ConfigurationProfile, ImportMode, ImportResult } from "@azure/app-configuration-importer";
import { FileFeatureFlagSource, FileConfigurationSyncOptions } from "@azure/app-configuration-importer-file-source";

// Load the .env file if it exists
import * as dotenv from "dotenv";
dotenv.config();

export async function main() {
  // Set the following environment variable.
  const connectionString = process.env["APPCONFIG_CONNECTION_STRING"];

  if (!connectionString) {
    throw "Connection string cannot be null";
  }

  const client = new FeatureFlagClient(connectionString);
  const featureFlagImporterClient = new FeatureFlagImporter(client);

  const options: FileConfigurationSyncOptions = {
    filePath: path.join(__dirname, "..", "testFiles/ffset.json"),
    format: ConfigurationFormat.Json,
    profile: ConfigurationProfile.FfSet
  };

  const timeout = 30;
  let successCount = 0;

  const progressCallBack = (progressResults: ImportResult) => {
    successCount = progressResults.successCount;
  };

  try {
    await featureFlagImporterClient.Import(
      new FileFeatureFlagSource(options),
      {
        timeout: timeout,
        progressCallback: progressCallBack,
        strict: false,
        importMode: ImportMode.IgnoreMatch
      }
    );
  }
  catch (error) {
    console.log("Failed to import feature flags", error);
  }

  console.log(`'${successCount}' feature flags were uploaded to Azure App Configuration`);
}

main().catch((error) => {
  console.log("error", error);
});
