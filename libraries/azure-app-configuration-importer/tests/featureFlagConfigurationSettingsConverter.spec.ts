// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
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
import { MsFeatureFlagValue } from "../src/featureFlag";

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
    const featureFlag1 = JSON.parse(configurationSettings[1].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureT");
    assert.equal(JSON.stringify(featureFlag1.conditions), "{\"client_filters\":[]}");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}${options.prefix}FeatureU`);
    const featureFlag2 = JSON.parse(configurationSettings[2].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureU");
    assert.equal(JSON.stringify(featureFlag2.conditions), "{\"client_filters\":[]}");
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[3].key, `${featureFlagPrefix}${options.prefix}FeatureV`);
    const featureFlag3 = JSON.parse(configurationSettings[3].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag3.id, "FeatureV");
    assert.equal(
      JSON.stringify(featureFlag3.conditions),
      "{\"client_filters\":[{\"name\":\"TimeWindow\",\"parameters\":{\"Start\":\"Wed, 01 May 2019 13:59:59 GMT\",\"End\":\"Mon, 01 July 2019 00:00:00 GMT\"}}]}"
    );
    assert.isTrue(featureFlag3.enabled);
    assert.equal(configurationSettings[4].key, `${featureFlagPrefix}${options.prefix}FeatureX`);
    const featureFlag4 = JSON.parse(configurationSettings[4].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag4.id, "FeatureX");
    assert.equal(JSON.stringify(featureFlag4.conditions), "{\"client_filters\":[]}");
    assert.isFalse(featureFlag4.enabled);
    assert.equal(configurationSettings[5].key, `${featureFlagPrefix}${options.prefix}FeatureY`);
    const featureFlag5 = JSON.parse(configurationSettings[5].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag5.id, "FeatureY");
    assert.equal(JSON.stringify(featureFlag5.conditions), "{\"client_filters\":[]}");
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
    const featureFlag1 = JSON.parse(configurationSettings[1].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureT");
    assert.equal(JSON.stringify(featureFlag1.conditions), "{\"client_filters\":[]}");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}FeatureU`);
    const featureFlag2 = JSON.parse(configurationSettings[2].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureU");
    assert.equal(JSON.stringify(featureFlag2.conditions), "{\"client_filters\":[]}");
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[3].key, `${featureFlagPrefix}FeatureV`);
    const featureFlag3 = JSON.parse(configurationSettings[3].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag3.id, "FeatureV");
    assert.equal(
      JSON.stringify(featureFlag3.conditions),
      "{\"client_filters\":[{\"name\":\"TimeWindow\",\"parameters\":{\"Start\":\"Wed, 01 May 2019 13:59:59 GMT\",\"End\":\"Mon, 01 July 2019 00:00:00 GMT\"}}]}"
    );
    assert.isTrue(featureFlag3.enabled);
    assert.equal(configurationSettings[4].key, `${featureFlagPrefix}FeatureX`);
    const featureFlag4 = JSON.parse(configurationSettings[4].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag4.id, "FeatureX");
    assert.equal(JSON.stringify(featureFlag4.conditions), "{\"client_filters\":[]}");
    assert.isFalse(featureFlag4.enabled);
    assert.equal(configurationSettings[5].key, `${featureFlagPrefix}FeatureY`);
    const featureFlag5 = JSON.parse(configurationSettings[5].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag5.id, "FeatureY");
    assert.equal(JSON.stringify(featureFlag5.conditions), "{\"client_filters\":[]}");
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
    const featureFlag1 = JSON.parse(configurationSettings[1].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureT");
    assert.equal(JSON.stringify(featureFlag1.conditions), "{\"client_filters\":[]}");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}FeatureU`);
    assert.equal(configurationSettings[2].label, "testLabel");
    assert.equal(configurationSettings[2].contentType, featureFlagContentType);
    assert.equal(configurationSettings[2].tags, testTag);
    const featureFlag2 = JSON.parse(configurationSettings[2].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureU");
    assert.equal(JSON.stringify(featureFlag2.conditions), "{\"client_filters\":[]}");
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[3].key, `${featureFlagPrefix}FeatureV`);
    assert.equal(configurationSettings[3].label, "testLabel");
    assert.equal(configurationSettings[3].contentType, featureFlagContentType);
    assert.equal(configurationSettings[3].tags, testTag);
    const featureFlag3 = JSON.parse(configurationSettings[3].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag3.id, "FeatureV");
    assert.equal(
      JSON.stringify(featureFlag3.conditions),
      "{\"client_filters\":[{\"name\":\"TimeWindow\",\"parameters\":{\"Start\":\"Wed, 01 May 2019 13:59:59 GMT\",\"End\":\"Mon, 01 July 2019 00:00:00 GMT\"}}]}"
    );
    assert.isTrue(featureFlag3.enabled);
    assert.equal(configurationSettings[4].key, `${featureFlagPrefix}FeatureX`);
    assert.equal(configurationSettings[4].label, "testLabel");
    assert.equal(configurationSettings[4].contentType, featureFlagContentType);
    assert.equal(configurationSettings[4].tags, testTag);
    const featureFlag4 = JSON.parse(configurationSettings[4].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag4.id, "FeatureX");
    assert.equal(JSON.stringify(featureFlag4.conditions), "{\"client_filters\":[]}");
    assert.isFalse(featureFlag4.enabled);
    assert.equal(configurationSettings[5].key, `${featureFlagPrefix}FeatureY`);
    assert.equal(configurationSettings[5].label, "testLabel");
    assert.equal(configurationSettings[5].contentType, featureFlagContentType);
    assert.equal(configurationSettings[5].tags, testTag);
    const featureFlag5 = JSON.parse(configurationSettings[5].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag5.id, "FeatureY");
    assert.equal(JSON.stringify(featureFlag5.conditions), "{\"client_filters\":[]}");
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
    const featureFlag1 = JSON.parse(configurationSettings[0].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureT");
    assert.equal(JSON.stringify(featureFlag1.conditions), "{\"client_filters\":[]}");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[1].key, `${featureFlagPrefix}FeatureU`);
    assert.equal(configurationSettings[1].contentType, featureFlagContentType);
    const featureFlag2 = JSON.parse(configurationSettings[1].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureU");
    assert.equal(JSON.stringify(featureFlag2.conditions), "{\"client_filters\":[]}");
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}FeatureV`);
    assert.equal(configurationSettings[2].contentType, featureFlagContentType);
    const featureFlag3 = JSON.parse(configurationSettings[2].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag3.id, "FeatureV");
    assert.equal(
      JSON.stringify(featureFlag3.conditions),
      "{\"client_filters\":[{\"name\":\"TimeWindow\",\"parameters\":{\"start\":\"Wed, 01 May 2019 13:59:59 GMT\",\"end\":\"Mon, 01 July 2019 00:00:00 GMT\"}}]}"
    );
    assert.isTrue(featureFlag3.enabled);
  });

  it("Parse new ms fm schema json file", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/featureFlagsMsFmSchema.json")).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, `${featureFlagPrefix}Variant_Override_True`);
    assert.equal(configurationSettings[0].contentType, featureFlagContentType);
    const featureFlag1 = JSON.parse(configurationSettings[0].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag1.id, "Variant_Override_True");
    assert.equal(JSON.stringify(featureFlag1.conditions), "{\"client_filters\":[]}");
    assert.equal(JSON.stringify(featureFlag1.allocation), "{\"default_when_enabled\":\"True_Override\"}");
    assert.equal(JSON.stringify(featureFlag1.variants),
      "[{\"name\":\"True_Override\",\"status_override\":\"Disabled\",\"configuration_value\":\"default\"}]");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[1].key, `${featureFlagPrefix}Variant_Override_False`);
    assert.equal(configurationSettings[1].contentType, featureFlagContentType);
    const featureFlag2 = JSON.parse(configurationSettings[1].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag2.id, "Variant_Override_False");
    assert.equal(JSON.stringify(featureFlag2.conditions), "{\"client_filters\":[]}");
    assert.equal(JSON.stringify(featureFlag2.allocation), "{\"default_when_disabled\":\"False_Override\"}");
    assert.equal(JSON.stringify(featureFlag2.variants),
      "[{\"name\":\"False_Override\",\"status_override\":\"Enabled\",\"configuration_value\":\"default\"}]");
    assert.isTrue(featureFlag1.enabled);
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}TestVariants`);
    assert.equal(configurationSettings[2].contentType, featureFlagContentType);
    const featureFlag3 = JSON.parse(configurationSettings[2].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag3.id, "TestVariants");
    assert.equal(
      JSON.stringify(featureFlag3.conditions),
      "{\"client_filters\":[{\"Name\":\"TimeWindow\",\"Parameters\":{\"Start\":\"Wed, 01 May 2019 13:59:59 GMT\",\"End\":\"Mon, 01 July 2019 00:00:00 GMT\"}}]}"
    );
    assert.equal(JSON.stringify(featureFlag3.allocation),"{\"user\":[{\"variant\":\"Alpha\",\"users\":[\"Adam\"]},{\"variant\":\"Beta\",\"users\":[\"Britney\"]}]}");
    assert.equal(JSON.stringify(featureFlag3.variants),
      "[{\"name\":\"Alpha\",\"configuration_value\":\"The Variant Alpha.\"},{\"name\":\"Beta\",\"configuration_value\":\"The Variant Beta.\"}]");
    assert.isTrue(featureFlag3.enabled);
  });

  it("Parse new ms fm schema yaml file", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/featureFlagsMsFmSchema.yaml")).toString(),
      format: ConfigurationFormat.Yaml
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, `${featureFlagPrefix}Variant_Override_True`);
    assert.equal(configurationSettings[0].contentType, featureFlagContentType);
    const featureFlag1 = JSON.parse(configurationSettings[0].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag1.id, "Variant_Override_True");
    assert.equal(JSON.stringify(featureFlag1.conditions), "{\"client_filters\":[]}");
    assert.equal(JSON.stringify(featureFlag1.allocation), "{\"default_when_enabled\":\"True_Override\"}");
    assert.equal(JSON.stringify(featureFlag1.variants),
      "[{\"name\":\"True_Override\",\"status_override\":\"Disabled\",\"configuration_value\":\"default\"}]");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[1].key, `${featureFlagPrefix}Variant_Override_False`);
    assert.equal(configurationSettings[1].contentType, featureFlagContentType);
    const featureFlag2 = JSON.parse(configurationSettings[1].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag2.id, "Variant_Override_False");
    assert.equal(JSON.stringify(featureFlag2.conditions), "{\"client_filters\":[]}");
    assert.equal(JSON.stringify(featureFlag2.allocation), "{\"default_when_disabled\":\"False_Override\"}");
    assert.equal(JSON.stringify(featureFlag2.variants),
      "[{\"name\":\"False_Override\",\"status_override\":\"Enabled\",\"configuration_value\":\"default\"}]");
    assert.isTrue(featureFlag1.enabled);
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}TestVariants`);
    assert.equal(configurationSettings[2].contentType, featureFlagContentType);
    const featureFlag3 = JSON.parse(configurationSettings[2].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag3.id, "TestVariants");
    assert.equal(
      JSON.stringify(featureFlag3.conditions),
      "{\"client_filters\":[{\"Name\":\"TimeWindow\",\"Parameters\":{\"Start\":\"Wed, 01 May 2019 13:59:59 GMT\",\"End\":\"Mon, 01 July 2019 00:00:00 GMT\"}}]}"
    );
    assert.equal(JSON.stringify(featureFlag3.allocation),"{\"user\":[{\"variant\":\"Alpha\",\"users\":[\"Adam\"]},{\"variant\":\"Beta\",\"users\":[\"Britney\"]}]}");
    assert.equal(JSON.stringify(featureFlag3.variants),
      "[{\"name\":\"Alpha\",\"configuration_value\":\"The Variant Alpha.\"},{\"name\":\"Beta\",\"configuration_value\":\"The Variant Beta.\"}]");
    assert.isTrue(featureFlag3.enabled);
  });

  it("Invalid FeatureFlag json format, no variant name", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/featureflag/invalidVariant.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Invalid new ms fm schema json format", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/featureflag/invalidMsFmSchemaFormat.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Invalid new ms fm json format, no allocation user variant", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/featureflag/invalidAllocation.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Invalid new ms fm json format, invalid requirement type", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/featureflag/invalidRequirementTypeNewMsFmSchema.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Respect both feature management schemas, dotnet schema within feature_management in the same file", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/respectBothFmSchemaUnderscoreCase.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };

    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, `${featureFlagPrefix}FeatureX`);
    assert.equal(configurationSettings[0].contentType, featureFlagContentType);
    const featureFlag1 = JSON.parse(configurationSettings[0].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureX");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(JSON.stringify(featureFlag1.conditions), "{\"client_filters\":[]}");
    assert.equal(configurationSettings[1].key, `${featureFlagPrefix}FeatureY`);
    assert.equal(configurationSettings[1].contentType, featureFlagContentType);
    const featureFlag2 = JSON.parse(configurationSettings[1].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureY");
    assert.isFalse(featureFlag2.enabled);
    assert.equal(JSON.stringify(featureFlag2.conditions), "{\"client_filters\":[]}");
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}FeatureZ`);
    assert.equal(configurationSettings[2].contentType, featureFlagContentType);
    const featureFlag3 = JSON.parse(configurationSettings[2].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag3.id, "FeatureZ");
    assert.isTrue(featureFlag3.enabled);
    assert.equal(JSON.stringify(featureFlag3.conditions), "{\"client_filters\":[]}");
  });

  it("Respect both feature management schemas, FeatureManagement + feature_management in the same file", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/respectBothFmSchemaPascalCase.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };

    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, `${featureFlagPrefix}FeatureX`);
    assert.equal(configurationSettings[0].contentType, featureFlagContentType);
    const featureFlag1 = JSON.parse(configurationSettings[0].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureX");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[1].key, `${featureFlagPrefix}FeatureY`);
    assert.equal(configurationSettings[1].contentType, featureFlagContentType);
    const featureFlag2 = JSON.parse(configurationSettings[1].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureY");
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}FeatureZ`);
    assert.equal(configurationSettings[2].contentType, featureFlagContentType);
    const featureFlag3 = JSON.parse(configurationSettings[2].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag3.id, "FeatureZ");
    assert.isTrue(featureFlag3.enabled);
  });

  
  it("Invalid FeatureManagement format, invalid sections allowed", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/featureflag/invalidFmSections.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Respect both feature management schemas, feature-management + feature_management in the same file", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/respectBothFmSchemaHyphenCase.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };

    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, `${featureFlagPrefix}FeatureX`);
    assert.equal(configurationSettings[0].contentType, featureFlagContentType);
    const featureFlag1 = JSON.parse(configurationSettings[0].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureX");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[1].key, `${featureFlagPrefix}FeatureY`);
    assert.equal(configurationSettings[1].contentType, featureFlagContentType);
    const featureFlag2 = JSON.parse(configurationSettings[1].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureY");
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}FeatureZ`);
    assert.equal(configurationSettings[2].contentType, featureFlagContentType);
    const featureFlag3 = JSON.parse(configurationSettings[2].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag3.id, "FeatureZ");
    assert.isTrue(featureFlag3.enabled);
  });

  it("Respect both feature management schemas, featureManagement + feature_management  in the same file", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/respectBothFmSchemaCamelCase.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };

    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, `${featureFlagPrefix}FeatureX`);
    assert.equal(configurationSettings[0].contentType, featureFlagContentType);
    const featureFlag1 = JSON.parse(configurationSettings[0].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureX");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(
      JSON.stringify(featureFlag1.conditions),
      "{\"client_filters\":[{\"name\":\"TimeWindow\",\"parameters\":{\"Start\":\"Wed, 01 May 2019 13:59:59 GMT\",\"End\":\"Mon, 01 July 2019 00:00:00 GMT\"}}]}"
    );
    assert.equal(configurationSettings[1].key, `${featureFlagPrefix}FeatureY`);
    assert.equal(configurationSettings[1].contentType, featureFlagContentType);
    const featureFlag2 = JSON.parse(configurationSettings[1].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureY");
    assert.isFalse(featureFlag2.enabled);
    assert.equal(configurationSettings[2].key, `${featureFlagPrefix}FeatureZ`);
    assert.equal(configurationSettings[2].contentType, featureFlagContentType);
    const featureFlag3 = JSON.parse(configurationSettings[2].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag3.id, "FeatureZ");
    assert.isTrue(featureFlag3.enabled);
  });

  it("Invalid Feature management schema json format, legacy schema should not appear in new msfm schema if already exists", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/featureflag/invalidMsFmSchemaWithBothSchemas.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Duplicate Feature Flags test, the later feature flag should win", async () => {
    const options: StringSourceOptions = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/duplicateFeatureFlagsInBothSchemas.json")).toString(),
      format: ConfigurationFormat.Json,
      skipFeatureFlags: false
    };

    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 2);
    assert.equal(configurationSettings[0].key, `${featureFlagPrefix}FeatureA`);
    assert.equal(configurationSettings[0].contentType, featureFlagContentType);
    const featureFlag1 = JSON.parse(configurationSettings[0].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag1.id, "FeatureA");
    assert.isTrue(featureFlag1.enabled);
    assert.equal(configurationSettings[1].key, `${featureFlagPrefix}FeatureZ`);
    assert.equal(configurationSettings[1].contentType, featureFlagContentType);
    const featureFlag2 = JSON.parse(configurationSettings[1].value as string) as MsFeatureFlagValue;
    assert.equal(featureFlag2.id, "FeatureZ");
    assert.isFalse(featureFlag2.enabled);
  });

});
