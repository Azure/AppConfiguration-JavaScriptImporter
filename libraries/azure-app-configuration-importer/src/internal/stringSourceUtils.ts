// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as jsyaml from "js-yaml";
import { getProperties } from "properties-file";
import stripJSONComments from "strip-json-comments";
import { ConfigurationFormat, ConfigurationProfile } from "../enums";
import { ArgumentError, ParseError } from "../errors";

/** @internal */
export function parseStringData(data: string, format: ConfigurationFormat): Record<string, unknown> {
  if (/^\uFEFF/.test(data)) {
    throw new ParseError(
      "Failed to parse data: An invalid encoding, UTF-8 with BOM, was detected. Please update encoding to UTF-8 without BOM."
    );
  }

  try {
    let loadedData: unknown;
    switch (format) {
      case ConfigurationFormat.Json:
        loadedData = JSON.parse(stripJSONComments(data));
        break;
      case ConfigurationFormat.Yaml:
        loadedData = jsyaml.load(data, { schema: jsyaml.JSON_SCHEMA });
        if (loadedData === undefined) {
          throw new ParseError("Failed to parse data: Not a valid yaml format.");
        }
        break;
      case ConfigurationFormat.Properties:
        loadedData = getProperties(data);
        break;
      default:
        throw new ArgumentError("Data Format provided is not supported. Supported values are: Json, Yaml and Properties.");
    }

    if (!loadedData || typeof loadedData !== "object" || Array.isArray(loadedData)) {
      throw new ParseError(`Type of data be parsed is ${typeof loadedData}, not a valid object type`);
    }
    return loadedData as Record<string, unknown>;
  }
  catch (error: any) {
    if (error instanceof ParseError || error instanceof ArgumentError) {
      throw error;
    }
    throw new ParseError(`Failed to parse data: ${error.message}`);
  }
}

/** @internal */
export function detectConfigurationProfile(
  loadedData: Record<string, unknown>,
  expectedProfile?: ConfigurationProfile
): ConfigurationProfile {
  let detectedProfile = ConfigurationProfile.Default;
  if (Object.prototype.hasOwnProperty.call(loadedData, "profile")) {
    const profile = loadedData.profile;
    if (typeof profile !== "string" || profile.trim().length === 0) {
      throw new ArgumentError("The document profile must be a non-empty string.");
    }
    if (profile === "appconfig/kvset") {
      detectedProfile = ConfigurationProfile.KvSet;
    }
    else if (profile === "appconfig/ffset") {
      detectedProfile = ConfigurationProfile.FfSet;
    }
    else {
      throw new ArgumentError(`The document profile '${profile}' is not supported.`);
    }
    delete loadedData.profile;
  }

  if (expectedProfile !== undefined && expectedProfile !== detectedProfile) {
    throw new ArgumentError("The source profile option does not match the document profile.");
  }
  return detectedProfile;
}