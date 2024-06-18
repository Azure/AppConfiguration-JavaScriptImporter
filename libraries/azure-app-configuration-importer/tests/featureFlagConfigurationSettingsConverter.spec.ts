import {
  FeatureFlagValue,
  featureFlagContentType,
  featureFlagPrefix
} from "@azure/app-configuration";
import { assert } from "chai";
import * as path from "path";
import * as fs from "fs";
import { ConfigurationFormat } from "../src/enums";
import { ArgumentError } from "../src/errors";
import { StringConfigurationSettingsSource } from "../src/settingsImport/stringConfigurationSettingsSource";
import { StringSourceOptions } from "../src/importOptions";
import { assertThrowAsync } from "./utlis";

describe("Parse FeatureFlag Json format file", () => {
  it("Invalid FeatureFlag json format, no filter name", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/featureflag/noFilterName.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Invalid FeatureFlag json format, invalid format, type error", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/featureflag/invalidFormat.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Invalid FeatureFlag json format, invalid format, no EnableFor attribute", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/featureflag/noEnableFor.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Parse key value config and feature managment config correctly, skip feature flag keep default", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/configFileFeatureFlag.json")).toString(),
      format: ConfigurationFormat.Json,
      prefix: "testprefix/"
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 6);
    assert.equal(configurationSettings[0].key, "testprefix/app");
    assert.equal(
      configurationSettings[0].value,
      "{\"Settings\":{\"BackgroundColor\":\"Yellow\",\"FontSize\":\"45\",\"Fruit\":\"Banana\",\"Color\":\"Orange\",\"FontColor\":\"Black\"}}"
    );
    assert.equal(configurationSettings[1].key, `${featureFlagPrefix}${options.prefix}FeatureT`);
    const featureFlag1 = configurationSettings[1].value as FeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureT");
    assert.equal(JSON.stringify(featureFlag1.conditions), "{\"clientFilters\":[]}");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}${options.prefix}FeatureU`);
    const featureFlag2 = configurationSettings[2].value as FeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureU");
    assert.equal(JSON.stringify(featureFlag2.conditions), "{\"clientFilters\":[]}");
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[3].key, `${featureFlagPrefix}${options.prefix}FeatureV`);
    const featureFlag3 = configurationSettings[3].value as FeatureFlagValue;
    assert.equal(featureFlag3.id, "FeatureV");
    assert.equal(
      JSON.stringify(featureFlag3.conditions),
      "{\"clientFilters\":[{\"name\":\"TimeWindow\",\"parameters\":{\"Start\":\"Wed, 01 May 2019 13:59:59 GMT\",\"End\":\"Mon, 01 July 2019 00:00:00 GMT\"}}]}"
    );
    assert.isTrue(featureFlag3.enabled);
    assert.equal(configurationSettings[4].key, `${featureFlagPrefix}${options.prefix}FeatureX`);
    const featureFlag4 = configurationSettings[4].value as FeatureFlagValue;
    assert.equal(featureFlag4.id, "FeatureX");
    assert.equal(JSON.stringify(featureFlag4.conditions), "{\"clientFilters\":[]}");
    assert.isFalse(featureFlag4.enabled);
    assert.equal(configurationSettings[5].key, `${featureFlagPrefix}${options.prefix}FeatureY`);
    const featureFlag5 = configurationSettings[5].value as FeatureFlagValue;
    assert.equal(featureFlag5.id, "FeatureY");
    assert.equal(JSON.stringify(featureFlag5.conditions), "{\"clientFilters\":[]}");
    assert.isTrue(featureFlag5.enabled);
  });

  it("Parse key value config and feature managment config correctly, skip feature flag", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/configFileFeatureFlag.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: true
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 1);
    assert.equal(configurationSettings[0].key, "app");
    assert.equal(
      configurationSettings[0].value,
      "{\"Settings\":{\"BackgroundColor\":\"Yellow\",\"FontSize\":\"45\",\"Fruit\":\"Banana\",\"Color\":\"Orange\",\"FontColor\":\"Black\"}}"
    );
  });

  it("Parse key value config and feature managment config correctly, involve feature flag", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/configFileFeatureFlag.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 6);
    assert.equal(configurationSettings[0].key, "app");
    assert.equal(
      configurationSettings[0].value,
      "{\"Settings\":{\"BackgroundColor\":\"Yellow\",\"FontSize\":\"45\",\"Fruit\":\"Banana\",\"Color\":\"Orange\",\"FontColor\":\"Black\"}}"
    );
    assert.equal(configurationSettings[1].key, `${featureFlagPrefix}FeatureT`);
    const featureFlag1 = configurationSettings[1].value as FeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureT");
    assert.equal(JSON.stringify(featureFlag1.conditions), "{\"clientFilters\":[]}");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}FeatureU`);
    const featureFlag2 = configurationSettings[2].value as FeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureU");
    assert.equal(JSON.stringify(featureFlag2.conditions), "{\"clientFilters\":[]}");
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[3].key, `${featureFlagPrefix}FeatureV`);
    const featureFlag3 = configurationSettings[3].value as FeatureFlagValue;
    assert.equal(featureFlag3.id, "FeatureV");
    assert.equal(
      JSON.stringify(featureFlag3.conditions),
      "{\"clientFilters\":[{\"name\":\"TimeWindow\",\"parameters\":{\"Start\":\"Wed, 01 May 2019 13:59:59 GMT\",\"End\":\"Mon, 01 July 2019 00:00:00 GMT\"}}]}"
    );
    assert.isTrue(featureFlag3.enabled);
    assert.equal(configurationSettings[4].key, `${featureFlagPrefix}FeatureX`);
    const featureFlag4 = configurationSettings[4].value as FeatureFlagValue;
    assert.equal(featureFlag4.id, "FeatureX");
    assert.equal(JSON.stringify(featureFlag4.conditions), "{\"clientFilters\":[]}");
    assert.isFalse(featureFlag4.enabled);
    assert.equal(configurationSettings[5].key, `${featureFlagPrefix}FeatureY`);
    const featureFlag5 = configurationSettings[5].value as FeatureFlagValue;
    assert.equal(featureFlag5.id, "FeatureY");
    assert.equal(JSON.stringify(featureFlag5.conditions), "{\"clientFilters\":[]}");
    assert.isTrue(featureFlag5.enabled);
  });

  it("Parse key value config and feature management config correctly, set tags,label and contentType", async () => {
    const testTag = {
      testTag: "TagValue"
    };
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/configFileFeatureFlag.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false,
      label: "testLabel",
      tags: testTag,
      contentType: featureFlagContentType
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 6);
    assert.equal(configurationSettings[0].key, "app");
    assert.equal(configurationSettings[0].label, "testLabel");
    assert.equal(configurationSettings[0].tags, testTag);
    assert.equal(configurationSettings[0].contentType, featureFlagContentType);
    assert.equal(
      configurationSettings[0].value,
      "{\"Settings\":{\"BackgroundColor\":\"Yellow\",\"FontSize\":\"45\",\"Fruit\":\"Banana\",\"Color\":\"Orange\",\"FontColor\":\"Black\"}}"
    );
    assert.equal(configurationSettings[1].key, `${featureFlagPrefix}FeatureT`);
    assert.equal(configurationSettings[1].label, "testLabel");
    assert.equal(configurationSettings[1].contentType, featureFlagContentType);
    assert.equal(configurationSettings[1].tags, testTag);
    const featureFlag1 = configurationSettings[1].value as FeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureT");
    assert.equal(JSON.stringify(featureFlag1.conditions), "{\"clientFilters\":[]}");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}FeatureU`);
    assert.equal(configurationSettings[2].label, "testLabel");
    assert.equal(configurationSettings[2].contentType, featureFlagContentType);
    assert.equal(configurationSettings[2].tags, testTag);
    const featureFlag2 = configurationSettings[2].value as FeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureU");
    assert.equal(JSON.stringify(featureFlag2.conditions), "{\"clientFilters\":[]}");
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[3].key, `${featureFlagPrefix}FeatureV`);
    assert.equal(configurationSettings[3].label, "testLabel");
    assert.equal(configurationSettings[3].contentType, featureFlagContentType);
    assert.equal(configurationSettings[3].tags, testTag);
    const featureFlag3 = configurationSettings[3].value as FeatureFlagValue;
    assert.equal(featureFlag3.id, "FeatureV");
    assert.equal(
      JSON.stringify(featureFlag3.conditions),
      "{\"clientFilters\":[{\"name\":\"TimeWindow\",\"parameters\":{\"Start\":\"Wed, 01 May 2019 13:59:59 GMT\",\"End\":\"Mon, 01 July 2019 00:00:00 GMT\"}}]}"
    );
    assert.isTrue(featureFlag3.enabled);
    assert.equal(configurationSettings[4].key, `${featureFlagPrefix}FeatureX`);
    assert.equal(configurationSettings[4].label, "testLabel");
    assert.equal(configurationSettings[4].contentType, featureFlagContentType);
    assert.equal(configurationSettings[4].tags, testTag);
    const featureFlag4 = configurationSettings[4].value as FeatureFlagValue;
    assert.equal(featureFlag4.id, "FeatureX");
    assert.equal(JSON.stringify(featureFlag4.conditions), "{\"clientFilters\":[]}");
    assert.isFalse(featureFlag4.enabled);
    assert.equal(configurationSettings[5].key, `${featureFlagPrefix}FeatureY`);
    assert.equal(configurationSettings[5].label, "testLabel");
    assert.equal(configurationSettings[5].contentType, featureFlagContentType);
    assert.equal(configurationSettings[5].tags, testTag);
    const featureFlag5 = configurationSettings[5].value as FeatureFlagValue;
    assert.equal(featureFlag5.id, "FeatureY");
    assert.equal(JSON.stringify(featureFlag5.conditions), "{\"clientFilters\":[]}");
    assert.isTrue(featureFlag5.enabled);
  });

  it("Importing feature flag properties file is not supported", async () => {
    const filePath: string = path.join("__dirname", "../tests/sources/configFeatureFlag.properties");
    const options: StringSourceOptions = {
      data: fs.readFileSync(filePath).toString(),
      format: ConfigurationFormat.Properties
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    try {
      await stringConfigurationSource.GetConfigurationSettings();
    }
    catch (error:any) {
      assert.isTrue(error instanceof ArgumentError);
      assert.strictEqual(error.message,
        "Importing feature flag in Properties format is not supported. Anything in the Properties format being imported will be treated as key value.");
    }
  });

  it("Successfully parse configurations from properties file if includes not startswith feature-management", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/configIncludeFFKey.properties")).toString(),
      format: ConfigurationFormat.Properties
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();
    
    assert.equal(configurationSettings.length, 4);
    assert.equal(configurationSettings[0].key, "app.Settings.new.Background.Color");
    assert.equal(configurationSettings[0].value, "Yellow");
    assert.equal(configurationSettings[1].key, "app.Settings.new.Font.Size");
    assert.equal(configurationSettings[1].value, "45");
    assert.equal(
      configurationSettings[2].key,
      "FeatureA.feature-management.enabled-for.name.alwaysOn"
    );
    assert.equal(
      configurationSettings[3].key,
      "FeatureB.FeatureManagement.EnabledFor.name.alwaysOn"
    );
  });

  it("Successfully parse configurations from properties file if skipFeatureFlags is true", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/configFeatureFlag.properties")).toString(),
      format: ConfigurationFormat.Properties,
      skipFeatureFlags: true
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 6);
    assert.equal(configurationSettings[0].key, "app.Settings.new.Background.Color");
    assert.equal(configurationSettings[0].value, "Yellow");
    assert.equal(configurationSettings[1].key, "app.Settings.new.Font.Size");
    assert.equal(configurationSettings[1].value, "45");
    assert.equal(
      configurationSettings[2].key,
      "feature-management.FeatureA.enabled-for.name.alwaysOn"
    );
    assert.equal(
      configurationSettings[3].key,
      "FeatureManagement.FeatureB.EnabledFor.name.alwaysOn"
    );
    assert.equal(
      configurationSettings[4].key,
      "featureManagement.FeatureC.enabledFor.name.alwaysOn"
    );
    assert.equal(
      configurationSettings[5].key,
      "feature_management.FeatureD.enabled_for.name.alwaysOn"
    );
  });

  it("Parse feature flag yaml file", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/featureFlags.yaml")).toString(),
      format: ConfigurationFormat.Yaml
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, `${featureFlagPrefix}FeatureT`);
    assert.equal(configurationSettings[0].contentType, featureFlagContentType);
    const featureFlag1 = configurationSettings[0].value as FeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureT");
    assert.equal(JSON.stringify(featureFlag1.conditions), "{\"clientFilters\":[]}");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[1].key, `${featureFlagPrefix}FeatureU`);
    assert.equal(configurationSettings[1].contentType, featureFlagContentType);
    const featureFlag2 = configurationSettings[1].value as FeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureU");
    assert.equal(JSON.stringify(featureFlag2.conditions), "{\"clientFilters\":[]}");
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}FeatureV`);
    assert.equal(configurationSettings[2].contentType, featureFlagContentType);
    const featureFlag3 = configurationSettings[2].value as FeatureFlagValue;
    assert.equal(featureFlag3.id, "FeatureV");
    assert.equal(
      JSON.stringify(featureFlag3.conditions),
      "{\"clientFilters\":[{\"name\":\"TimeWindow\",\"parameters\":{\"start\":\"Wed, 01 May 2019 13:59:59 GMT\",\"end\":\"Mon, 01 July 2019 00:00:00 GMT\"}}]}"
    );
    assert.isTrue(featureFlag3.enabled);
  });
});
