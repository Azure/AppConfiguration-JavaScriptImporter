// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * @summary Demonstrates importing enhanced feature flags from a String source
*/
import { FeatureFlagClient } from "@azure/app-configuration";
import { FeatureFlagImporter, StringFeatureFlagSource, StringSourceOptions, ConfigurationFormat, ConfigurationProfile, ImportMode, ImportResult } from "@azure/app-configuration-importer";

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

  // A feature flag set (appconfig/ffset) document describing the enhanced feature flags to import.
  const featureFlagData = {
    profile: "appconfig/ffset",
    items: [
      {
        name: "Beta",
        label: "Production",
        enabled: true,
        description: "Enables the beta checkout experience.",
        conditions: {
          requirementType: "Any",
          filters: [
            {
              name: "Microsoft.Percentage",
              parameters: {
                Value: "50"
              }
            }
          ]
        }
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

  const timeout = 30;
  let successCount = 0;

  const progressCallBack = (progressResults: ImportResult) => {
    successCount = progressResults.successCount;
  };

  try {
    await featureFlagImporterClient.Import(
      new StringFeatureFlagSource(options),
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
