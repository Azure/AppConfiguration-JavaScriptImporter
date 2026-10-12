// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * @summary Demonstrates importing enhanced feature flags from a ReadableStream source
*/
import path from "path";
import fs from "fs";
import { FeatureFlagClient } from "@azure/app-configuration";
import {
  FeatureFlagImporter,
  ReadableStreamFeatureFlagSource,
  ReadableStreamSourceOptions,
  ConfigurationFormat,
  ConfigurationProfile,
  ImportMode,
  ImportResult
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
  const filePath = path.join(__dirname, "..", "testFiles/ffset.json");

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream<Uint8Array>({
    start(controller) {
      fs.readFile(filePath, { encoding: "utf-8" }, (error, data) => {
        if (error) {
          controller.error(error);
        }
        else {
          controller.enqueue(encoder.encode(data));
          controller.close();
        }
      });
    }
  });

  const options: ReadableStreamSourceOptions = {
    data: readableStream,
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
      new ReadableStreamFeatureFlagSource(options),
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
