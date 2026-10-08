// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * @summary Demonstrates previewing feature flag changes and importing them via a pre-calculated changes source
*/
import { FeatureFlagClient } from "@azure/app-configuration";
import {
  FeatureFlagImporter,
  StringFeatureFlagSource,
  FeatureFlagChangesSource,
  StringSourceOptions,
  ConfigurationFormat,
  ConfigurationProfile,
  ImportMode,
  ImportResult,
  FeatureFlagChange
} from "@azure/app-configuration-importer";

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

  const featureFlagData = {
    profile: "appconfig/ffset",
    items: [
      {
        name: "Beta",
        label: "Production",
        enabled: true,
        description: "Enables the beta checkout experience."
      },
      {
        name: "DarkMode",
        enabled: false
      }
    ]
  };

  const options: StringSourceOptions = {
    data: JSON.stringify(featureFlagData),
    format: ConfigurationFormat.Json,
    profile: ConfigurationProfile.FfSet
  };

  // Preview the changes between the source and the store without applying them.
  const changes: FeatureFlagChange[] = await featureFlagImporterClient.GetFeatureFlagChanges(
    new StringFeatureFlagSource(options),
    false,
    ImportMode.IgnoreMatch
  );

  console.log(`'${changes.length}' feature flag changes were calculated`);

  const timeout = 30;
  let successCount = 0;

  const progressCallBack = (progressResults: ImportResult) => {
    successCount = progressResults.successCount;
  };

  // Apply the pre-calculated changes. 'strict' and 'importMode' are not applicable when importing changes.
  try {
    await featureFlagImporterClient.Import(
      new FeatureFlagChangesSource(changes),
      {
        timeout: timeout,
        progressCallback: progressCallBack
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
