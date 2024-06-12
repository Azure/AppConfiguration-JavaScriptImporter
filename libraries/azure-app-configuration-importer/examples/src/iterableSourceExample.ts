// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * @summary Demonstrates importing configurations from an Iterable source 
*/
import { AppConfigurationClient } from "@azure/app-configuration";
import { AppConfigurationImporter, IterableSourceOptions, IterableConfigurationSettingsSource, ImportMode, ImportResult } from "@azure/app-configuration-importer";

// Load the .env file if it exists
import * as dotenv from "dotenv";
dotenv.config();

export async function main() {
  // Set the following environment variable, set to a store you would like to import from
  const srcConnectionString =  process.env["APPCONFIG_CONNECTION_STRING_SRC_STORE"];

  // Set the following environment variable, set to the store you would like to import to.
  const targetConnectionString =  process.env["APPCONFIG_CONNECTION_STRING"];

  if (!srcConnectionString || !targetConnectionString) {
    throw "Connection string cannot be null";
  }

  const sourceClient = new AppConfigurationClient(srcConnectionString);
  const targetClient = new AppConfigurationClient(targetConnectionString);

  const appConfigurationImporterClient = new AppConfigurationImporter(targetClient);
  
  const options: IterableSourceOptions ={
    data: sourceClient.listConfigurationSettings({labelFilter: "Label 1"}), // Ensure the source store has a number of key-values whose label is "Label 1"
    prefix: "test",
    label: "MyLabel",
    contentType: "text"
  };

  const maxTimeout = 1000;
  let successCount = 0;

  const progressCallBack = (progressResults: ImportResult) => {
    successCount = progressResults.successCount;
  };
    
  try {
    await appConfigurationImporterClient.Import(
      new IterableConfigurationSettingsSource(options),
      maxTimeout,
      false,
      progressCallBack,
      ImportMode.IgnoreMatch
    );
  }
  catch (error) {
    console.log("Failed to import settings", error);
  }

  console.log(`'${successCount}' key-values were uploaded to Azure App Configuration`);
}

main().catch((error)=>{
  console.log("error", error);
});