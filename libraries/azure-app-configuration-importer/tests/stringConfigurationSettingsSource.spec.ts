// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert } from "chai";
import * as path from "path";
import * as fs from "fs";
import { ArgumentError, ParseError } from "../src/errors";
import { ConfigurationFormat, ConfigurationProfile } from "../src/enums";
import { StringConfigurationSettingsSource } from "../src/settingsImport/stringConfigurationSettingsSource";
import { StringFeatureFlagSource } from "../src/settingsImport/stringFeatureFlagSource";
import { assertThrowAsync } from "./utlis";

describe("String configuration source test", () => {
  it("Throw argument error when set unexpected option when the profile is kvset", async () => {
    const simpleKeyValueFilePath: string = path.join("__dirname", "../tests/sources/simpleKeyValue.json");
    const options1 = {
      data: fs.readFileSync(simpleKeyValueFilePath).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      separator: ":"
    };
    const options2 = {
      data: fs.readFileSync(simpleKeyValueFilePath).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      label: "some"
    };
    const options3 = {
      data: fs.readFileSync(simpleKeyValueFilePath).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      tags: { some: "value" }
    };
    const options4 = {
      data: fs.readFileSync(simpleKeyValueFilePath).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      depth: 3
    };
    const notUTF8StringFilePath: string = path.join("__dirname", "../tests/sources/invalid/notUTF8.json");
    const options5 = {
      data: fs.readFileSync(notUTF8StringFilePath).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      prefix: "prefix/"
    };
    const options6 = {
      data: fs.readFileSync(notUTF8StringFilePath).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      contentType: "application/json"
    };

    assert.throw(() => new StringConfigurationSettingsSource(options1), ArgumentError);
    assert.throw(() => new StringConfigurationSettingsSource(options2), ArgumentError);
    assert.throw(() => new StringConfigurationSettingsSource(options3), ArgumentError);
    assert.throw(() => new StringConfigurationSettingsSource(options4), ArgumentError);
    assert.throw(() => new StringConfigurationSettingsSource(options5), ArgumentError);
    assert.throw(() => new StringConfigurationSettingsSource(options6), ArgumentError);
  });

  it("Throw argument error if format is not json when the profile is kvset", async () => {
    const stringFilePath: string = path.join("__dirname", "../tests/sources/simpleKeyValue.json");
    const options = {
      data: fs.readFileSync(stringFilePath).toString(),
      format: ConfigurationFormat.Yaml,
      profile: ConfigurationProfile.KvSet
    };

    assert.throw(() => new StringConfigurationSettingsSource(options), ArgumentError);
  });

  it("Throw argument error if depth is set but separator is not", async () => {
    const stringFilePath: string = path.join("__dirname", "../tests/sources/simpleKeyValue.json");
    const options = {
      data: fs.readFileSync(stringFilePath).toString(),
      format: ConfigurationFormat.Json,
      depth: 3
    };

    assert.throw(() => new StringConfigurationSettingsSource(options), ArgumentError);
  });

  it("Throw argument error if separator is not valid", async () => {
    const stringFilePath: string = path.join("__dirname", "../tests/sources/simpleKeyValue.json");
    const options = {
      data: fs.readFileSync(stringFilePath).toString(),
      format: ConfigurationFormat.Json,
      separator: "("
    };

    assert.throw(() => new StringConfigurationSettingsSource(options), ArgumentError);
  });

  it("Throw error if string is not UTF8 encoded", async () => {
    const stringFilePath: string = path.join("__dirname", "../tests/sources/invalid/notUTF8.json");
    const options = {
      data: fs.readFileSync(stringFilePath).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ParseError);
  });

  it("Throw error if string is not in valid json format", async () => {
    const stringFilePath: string = path.join("__dirname", "../tests/sources/invalid/notJson.json");
    const options = {
      data: fs.readFileSync(stringFilePath).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ParseError);
  });

  it("Throw error if string is not in valid yaml format", async () => {
    const stringFilePath: string = path.join("__dirname", "../tests/sources/invalid/notYaml.yaml");
    const options = {
      data: fs.readFileSync(stringFilePath).toString(),
      format: ConfigurationFormat.Yaml
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ParseError);
  });

  it("Throw error if string content is not valid object", async () => {
    const stringFilePath: string = path.join("__dirname", "../tests/sources/invalid/invalidObject.json");
    const options = {
      data: fs.readFileSync(stringFilePath).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ParseError);
  });

  it("Throw error if format is not json when the contentType is json", async () => {
    const jsonStringFilePath: string = path.join("__dirname", "../tests/sources/nestedDeepKeyValue.json");
    const jsonString: string = fs.readFileSync(jsonStringFilePath).toString();
    const options1 = {
      data: jsonString,
      format: ConfigurationFormat.Properties,
      contentType: "application/json"
    };
    const options2 = {
      data: jsonString,
      format: ConfigurationFormat.Yaml,
      contentType: "application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8"
    };

    assert.throw(() => new StringConfigurationSettingsSource(options1), ArgumentError);
    assert.throw(() => new StringConfigurationSettingsSource(options2), ArgumentError);
  });
  
  it("Ignore comments in json file", async () => {
    const filePath = path.join("__dirname", "../tests/sources/jsonWithComments.json");
    const options = {
      data: fs.readFileSync(filePath).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();
    assert.equal(configurationSettings.length, 1);
    assert.equal(configurationSettings[0].key, "testKey1");
    assert.equal(configurationSettings[0].value, "testValue1");
  });

  it("Detects the kvset profile from document metadata", async () => {
    const source = new StringConfigurationSettingsSource({
      data: JSON.stringify({
        profile: "appconfig/kvset",
        items: [{ key: "testKey", value: "testValue", tags: {} }]
      }),
      format: ConfigurationFormat.Json
    });

    const configurationSettings = await source.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 1);
    assert.equal(configurationSettings[0].key, "testKey");
    assert.equal(configurationSettings[0].value, "testValue");
  });

  it("Rejects an unsupported document profile", async () => {
    const source = new StringConfigurationSettingsSource({
      data: JSON.stringify({ profile: "appconfig/unknown", items: [] }),
      format: ConfigurationFormat.Json
    });

    await assertThrowAsync(() => source.GetConfigurationSettings(), ArgumentError);
  });

  it("Rejects ffset on the configuration settings path", async () => {
    const source = new StringConfigurationSettingsSource({
      data: JSON.stringify({ profile: "appconfig/ffset", items: [] }),
      format: ConfigurationFormat.Json
    });

    await assertThrowAsync(() => source.GetConfigurationSettings(), ArgumentError);
  });

  it("Rejects an ffset source profile option", () => {
    assert.throw(() => new StringConfigurationSettingsSource({
      data: JSON.stringify({ profile: "appconfig/ffset", items: [] }),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.FfSet
    }), ArgumentError);
  });

  it("Rejects a source profile option without matching document metadata", async () => {
    const source = new StringConfigurationSettingsSource({
      data: JSON.stringify({ items: [] }),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    });

    await assertThrowAsync(() => source.GetConfigurationSettings(), ArgumentError);
  });

  it("Gets enhanced feature flags from an ffset document", async () => {
    const source = new StringFeatureFlagSource({
      data: JSON.stringify({
        profile: "appconfig/ffset",
        items: [{
          name: "Checkout",
          label: "Production",
          enabled: true,
          conditions: { filters: [] },
          tags: { owner: "commerce" }
        }]
      }),
      format: ConfigurationFormat.Json
    });

    const featureFlags = await source.GetFeatureFlags();

    assert.deepEqual(featureFlags, [{
      name: "Checkout",
      label: "Production",
      enabled: true,
      conditions: { filters: [] },
      tags: { owner: "commerce" }
    }]);
  });

  it("Gets only enhanced feature flags from marker-free Default content", async () => {
    const source = new StringFeatureFlagSource({
      data: JSON.stringify({
        ordinaryKey: "ignored",
        feature_management: {
          feature_flags: [{
            id: "Checkout",
            enabled: true,
            description: "Checkout experience",
            conditions: {
              requirement_type: "All",
              client_filters: [{
                name: "Microsoft.TimeWindow",
                parameters: { Start: "Wed, 01 May 2019 13:59:59 GMT" }
              }]
            },
            variants: [{
              name: "Blue",
              configuration_value: { color: "blue" },
              status_override: "Enabled"
            }],
            allocation: {
              default_when_enabled: "Blue",
              percentile: [{ variant: "Blue", from: 0, to: 100 }]
            },
            telemetry: {
              enabled: true,
              metadata: { owner: "commerce" }
            }
          }]
        }
      }),
      format: ConfigurationFormat.Json,
      prefix: "Test:",
      label: "Production",
      tags: { environment: "production" }
    });

    const featureFlags = await source.GetFeatureFlags();

    assert.deepEqual(featureFlags, [{
      name: "Test:Checkout",
      label: "Production",
      enabled: true,
      description: "Checkout experience",
      conditions: {
        requirementType: "All",
        filters: [{
          name: "Microsoft.TimeWindow",
          parameters: { Start: "Wed, 01 May 2019 13:59:59 GMT" }
        }]
      },
      variants: [{
        name: "Blue",
        value: "{\"color\":\"blue\"}",
        contentType: "application/json",
        statusOverride: "Enabled"
      }],
      allocation: {
        percentile: [{ variant: "Blue", from: 0, to: 100 }],
        defaultWhenEnabled: "Blue"
      },
      telemetry: {
        enabled: true,
        metadata: { owner: "commerce" }
      },
      tags: { environment: "production" }
    }]);
  });
});
