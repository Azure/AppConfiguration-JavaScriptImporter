// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert } from "chai";
import * as path from "path";
import { ArgumentError, ParseError, ConfigurationFormat, ConfigurationProfile, ArgumentNullError } from "@azure/app-configuration-importer";
import { FileConfigurationSettingsSource } from "../src/fileConfigurationSettingsSource";

describe("File configuration source test", () => {
  it("Throw argument error when set unexpected option when the profile is kvset", async () => {
    const options1 = {
      filePath: path.join("__dirname", "../tests/sources/simpleKeyValue.json"),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      separator: ":"
    };
    const options2 = {
      filePath: path.join("__dirname", "../tests/sources/simpleKeyValue.json"),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      label: "some"
    };
    const options3 = {
      filePath: path.join("__dirname", "../tests/sources/simpleKeyValue.json"),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      tags: { some: "value" }
    };
    const options4 = {
      filePath: path.join("__dirname", "../tests/sources/simpleKeyValue.json"),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      depth: 3
    };
    const options5 = {
      filePath: path.join("__dirname", "../tests/sources/invalid/notUTF8.json"),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      prefix: "prefix/"
    };
    const options6 = {
      filePath: path.join("__dirname", "../tests/sources/invalid/notUTF8.json"),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      contentType: "application/json"
    };

    assert.throw(() => new FileConfigurationSettingsSource(options1), ArgumentError);
    assert.throw(() => new FileConfigurationSettingsSource(options2), ArgumentError);
    assert.throw(() => new FileConfigurationSettingsSource(options3), ArgumentError);
    assert.throw(() => new FileConfigurationSettingsSource(options4), ArgumentError);
    assert.throw(() => new FileConfigurationSettingsSource(options5), ArgumentError);
    assert.throw(() => new FileConfigurationSettingsSource(options6), ArgumentError);
  });

  it("Throw argument error if format is not json when the profile is kvset", async () => {
    const options = {
      filePath: path.join("__dirname", "../tests/sources/simpleKeyValue.json"),
      format: ConfigurationFormat.Yaml,
      profile: ConfigurationProfile.KvSet
    };

    assert.throw(() => new FileConfigurationSettingsSource(options), ArgumentError);
  });

  it("Throw argument error if depth is set but separator is not", async () => {
    const options = {
      filePath: path.join("__dirname", "../tests/sources/simpleKeyValue.json"),
      format: ConfigurationFormat.Json,
      depth: 3
    };

    assert.throw(() => new FileConfigurationSettingsSource(options), ArgumentError);
  });

  it("Throw argument error if separator is not valid", async () => {
    const options = {
      filePath: path.join("__dirname", "../tests/sources/simpleKeyValue.json"),
      format: ConfigurationFormat.Json,
      separator: "("
    };

    assert.throw(() => new FileConfigurationSettingsSource(options), ArgumentError);
  });

  it("Throw error if file is not UTF8 encode", async () => {
    const options = {
      filePath: path.join("__dirname", "../tests/sources/invalid/notUTF8.json"),
      format: ConfigurationFormat.Json
    };
    const fileConfigurationSource = new FileConfigurationSettingsSource(options);

    assertThrowAsync(() => fileConfigurationSource.GetConfigurationSettings(), ParseError);
  });

  it("Throw error if file is not valid json file", async () => {
    const options = {
      filePath: path.join("__dirname", "../tests/sources/invalid/notJson.json"),
      format: ConfigurationFormat.Json
    };
    const fileConfigurationSource = new FileConfigurationSettingsSource(options);

    assertThrowAsync(() => fileConfigurationSource.GetConfigurationSettings(), ParseError);
  });

  it("Throw error if file is not valid yaml file", async () => {
    const options = {
      filePath: path.join("__dirname", "../tests/sources/invalid/notYaml.yaml"),
      format: ConfigurationFormat.Yaml
    };
    const fileConfigurationSource = new FileConfigurationSettingsSource(options);

    assertThrowAsync(() => fileConfigurationSource.GetConfigurationSettings(), ParseError);
  });

  it("Throw error if file content is not valid object", async () => {
    const options = {
      filePath: path.join("__dirname", "../tests/sources/invalid/invalidObject.json"),
      format: ConfigurationFormat.Json
    };
    const fileConfigurationSource = new FileConfigurationSettingsSource(options);

    assertThrowAsync(() => fileConfigurationSource.GetConfigurationSettings(), ParseError);
  });

  it("Throw error if format is not json when the contentType is json", async () => {
    const options1 = {
      filePath: path.join("__dirname", "../tests/sources/nestedDeepKeyValue.json"),
      format: ConfigurationFormat.Properties,
      contentType: "application/json"
    };
    const options2 = {
      filePath: path.join("__dirname", "../tests/sources/nestedDeepKeyValue.json"),
      format: ConfigurationFormat.Yaml,
      contentType: "application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8"
    };

    assert.throw(() => new FileConfigurationSettingsSource(options1), ArgumentError);
    assert.throw(() => new FileConfigurationSettingsSource(options2), ArgumentError);
  });

  it("Throw error if file path is empty or whitespace", async () => {
    const options1 = {
      filePath: "", // Empty
      format: ConfigurationFormat.Json
    };

    const options2 = {
      filePath: " ", // Whitespace
      format: ConfigurationFormat.Json
    };

    assert.throw(() => new FileConfigurationSettingsSource(options1), ArgumentNullError);
    assert.throw(() => new FileConfigurationSettingsSource(options2), ArgumentNullError);
  });
  
  it("Ignore comments in json file", async () => {
    const options = {
      filePath: path.join("__dirname", "../tests/sources/jsonWithComments.json"),
      format: ConfigurationFormat.Json
    };
    const fileConfigurationSource = new FileConfigurationSettingsSource(options);
    const configurationSettings = await fileConfigurationSource.GetConfigurationSettings();
    assert.equal(configurationSettings.length, 1);
    assert.equal(configurationSettings[0].key, "testKey1");
    assert.equal(configurationSettings[0].value, "testValue1");
  });

});

async function assertThrowAsync(asyncFunction:() => any, error: any): Promise<void> {
  let errorThrown: any;
  
  try {
    await asyncFunction();
  }
  catch (error: any) {
    errorThrown = error;
  }

  if (errorThrown) {
    assert.isTrue(errorThrown instanceof error);
  } 
  else {
    assert.fail("Expected error but no error was thrown");
  }
}