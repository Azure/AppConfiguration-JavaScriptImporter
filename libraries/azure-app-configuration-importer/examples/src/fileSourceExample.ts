// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * @summary Demonstrates importing configurations from a File source
*/
import path from "path";
import { AppConfigurationClient } from "@azure/app-configuration";
import { AppConfigurationImporter, ConfigurationFormat, ConfigurationProfile, ImportMode, ImportResult } from "@azure/app-configuration-importer";
import { FileConfigurationSettingsSource, FileConfigurationSyncOptions } from "@azure/app-configuration-importer-file-source";

// Load the .env file if it exists
import * as dotenv from "dotenv";
dotenv.config();

export async function main() {
  // Set the following environment variable.
  const connectionString = process.env["APPCONFIG_CONNECTION_STRING"];

  if (!connectionString) {
    throw "Connection string cannot be null";
  }

  const client = new AppConfigurationClient(connectionString);
  const appConfigurationImporterClient = new AppConfigurationImporter(client);
  
  const options: FileConfigurationSyncOptions = {
    filePath:  path.join(__dirname, "..", "testFiles/kvset.json"),
    format: ConfigurationFormat.Json,
    profile: ConfigurationProfile.KvSet
  };

  const maxTimeout = 1000;
  let successCount = 0;

  const progressCallBack = (progressResults: ImportResult) => {
    successCount = progressResults.successCount;
  };
    
  try {
    await appConfigurationImporterClient.Import(
      new FileConfigurationSettingsSource(options),
      maxTimeout,
      false,
      progressCallBack,
      ImportMode.IgnoreMatch
    );
  }
  catch(error) {
    console.log("Failed to import settings", error);
  }

  console.log(`'${successCount}' key-values were uploaded to Azure App Configuration`);
}

main().catch((error)=> {
  console.log("error", error);
});