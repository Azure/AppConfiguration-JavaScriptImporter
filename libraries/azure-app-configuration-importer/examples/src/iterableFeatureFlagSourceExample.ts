// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * @summary Demonstrates importing enhanced feature flags from an Iterable source
*/
import { FeatureFlagClient } from "@azure/app-configuration";
import { FeatureFlagImporter, IterableFeatureFlagSource, IterableFeatureFlagSourceOptions, ImportMode, ImportResult } from "@azure/app-configuration-importer";

// Load the .env file if it exists
import * as dotenv from "dotenv";
dotenv.config();

export async function main() {
  // Set the following environment variable, set to a store you would like to import from
  const srcConnectionString = process.env["APPCONFIG_CONNECTION_STRING_SRC_STORE"];

  // Set the following environment variable, set to the store you would like to import to.
  const targetConnectionString = process.env["APPCONFIG_CONNECTION_STRING"];

  if (!srcConnectionString || !targetConnectionString) {
    throw "Connection string cannot be null";
  }

  const sourceClient = new FeatureFlagClient(srcConnectionString);
  const targetClient = new FeatureFlagClient(targetConnectionString);

  const featureFlagImporterClient = new FeatureFlagImporter(targetClient);

  const options: IterableFeatureFlagSourceOptions = {
    data: sourceClient.listFeatureFlags({ labelFilter: "Label 1" }), // Ensure the source store has a number of feature flags whose label is "Label 1"
    prefix: "test",
    label: "MyLabel"
  };

  const timeout = 30;
  let successCount = 0;

  const progressCallBack = (progressResults: ImportResult) => {
    successCount = progressResults.successCount;
  };

  try {
    await featureFlagImporterClient.Import(
      new IterableFeatureFlagSource(options),
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
