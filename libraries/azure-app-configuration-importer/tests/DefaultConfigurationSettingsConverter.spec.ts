import { assert } from "chai";
import * as path from "path";
import * as fs from "fs";
import { ConfigurationFormat } from "../src/enums";
import { ArgumentError } from "../src/errors";
import { StringConfigurationSettingsSource } from "../src/settingsImport/StringConfigurationSettingsSource";
import { assertThrowAsync } from "./utlis";

describe("Parse Json format file", () => {
  it("Parse simple key value json file", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/SimpleKeyValue.json")).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, "testKey1");
    assert.equal(configurationSettings[0].value, "testValue1");
    assert.equal(configurationSettings[1].key, "testKey2");
    assert.equal(configurationSettings[1].value, "https://test.domain.com/user?name=Alice&age=18");
    assert.equal(configurationSettings[2].key, "testKey3");
    assert.equal(configurationSettings[2].value, "30");
  });

  it("Parse nested key value json file, does not set depth", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/NestedKeyValue.json")).toString(),
      format: ConfigurationFormat.Json,
      separator: ":"
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, "testKey1:testSubKey1");
    assert.equal(configurationSettings[0].value, "testValue1");
    assert.equal(configurationSettings[1].key, "testKey2:testSubKey2");
    assert.equal(configurationSettings[1].value, "https://test.domain.com/user?name=Alice&age=18");
    assert.equal(configurationSettings[2].key, "testKey3:testSubKey3");
    assert.equal(configurationSettings[2].value, "30");
  });

  it("Parse nested key value json file, set depth to 1", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/NestedKeyValue.json")).toString(),
      format: ConfigurationFormat.Json,
      separator: ":",
      depth: 1
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, "testKey1");
    assert.equal(configurationSettings[0].value, "{\"testSubKey1\":\"testValue1\"}");
    assert.equal(configurationSettings[1].key, "testKey2");
    assert.equal(
      configurationSettings[1].value,
      "{\"testSubKey2\":\"https://test.domain.com/user?name=Alice&age=18\"}"
    );
    assert.equal(configurationSettings[2].key, "testKey3");
    assert.equal(configurationSettings[2].value, "{\"testSubKey3\":\"30\"}");
  });

  it("Parse nested key value json file, set depth to number larger than 1", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/NestedDeepKeyValue.json")).toString(),
      format: ConfigurationFormat.Json,
      separator: ":",
      depth: 3
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 5);
    assert.equal(configurationSettings[0].key, "testKey1:testSubKey1:subKey1");
    assert.equal(configurationSettings[0].value, "{\"subKey1\":\"testValue1\"}");
    assert.equal(configurationSettings[1].key, "testKey2:testSubKey2:0");
    assert.equal(configurationSettings[1].value, "https://test.domain.com/user?name=Alice&age=18");
    assert.equal(configurationSettings[2].key, "testKey2:testSubKey2:1");
    assert.equal(configurationSettings[2].value, "https://test.domain.com/user?name=Iris&age=19");
    assert.equal(configurationSettings[3].key, "testKey2:testSubKey2:2");
    assert.equal(configurationSettings[3].value, "https://test.domain.com/user?name=Linda&age=3");
    assert.equal(configurationSettings[4].key, "testKey3:testSubKey3");
    assert.equal(configurationSettings[4].value, "30");
  });

  it("Parse nested key value json file with array", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/NestedDeepKeyValue.json")).toString(),
      format: ConfigurationFormat.Json,
      separator: ":",
      depth: 3
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 5);
    assert.equal(configurationSettings[0].key, "testKey1:testSubKey1:subKey1");
    assert.equal(configurationSettings[0].value, "{\"subKey1\":\"testValue1\"}");
    assert.equal(configurationSettings[1].key, "testKey2:testSubKey2:0");
    assert.equal(configurationSettings[1].value, "https://test.domain.com/user?name=Alice&age=18");
    assert.equal(configurationSettings[2].key, "testKey2:testSubKey2:1");
    assert.equal(configurationSettings[2].value, "https://test.domain.com/user?name=Iris&age=19");
    assert.equal(configurationSettings[3].key, "testKey2:testSubKey2:2");
    assert.equal(configurationSettings[3].value, "https://test.domain.com/user?name=Linda&age=3");
    assert.equal(configurationSettings[4].key, "testKey3:testSubKey3");
    assert.equal(configurationSettings[4].value, "30");
  });

  it("Parse nested key value json file correctly when does not set separator and depth", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/NestedDeepKeyValue.json")).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, "testKey1");
    assert.equal(
      configurationSettings[0].value,
      "{\"testSubKey1\":{\"subKey1\":{\"subKey1\":\"testValue1\"}}}"
    );
    assert.equal(configurationSettings[1].key, "testKey2");
    assert.equal(
      configurationSettings[1].value,
      "{\"testSubKey2\":[\"https://test.domain.com/user?name=Alice&age=18\",\"https://test.domain.com/user?name=Iris&age=19\",\"https://test.domain.com/user?name=Linda&age=3\"]}"
    );
    assert.equal(configurationSettings[2].key, "testKey3");
    assert.equal(configurationSettings[2].value, "{\"testSubKey3\":\"30\"}");
  });

  it("Set Prefix, Label in options", async () => {
    const testTag = {
      testTag: "TagValue"
    };
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/NestedDeepKeyValue.json")).toString(),
      format: ConfigurationFormat.Json,
      prefix: "testprefix/",
      label: "testLabel",
      tags: testTag
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, "testprefix/testKey1");
    assert.equal(configurationSettings[0].label, "testLabel");
    assert.equal(configurationSettings[0].tags, testTag);
    assert.equal(
      configurationSettings[0].value,
      "{\"testSubKey1\":{\"subKey1\":{\"subKey1\":\"testValue1\"}}}"
    );
    assert.equal(configurationSettings[1].key, "testprefix/testKey2");
    assert.equal(configurationSettings[1].label, "testLabel");
    assert.equal(configurationSettings[1].tags, testTag);
    assert.equal(
      configurationSettings[1].value,
      "{\"testSubKey2\":[\"https://test.domain.com/user?name=Alice&age=18\",\"https://test.domain.com/user?name=Iris&age=19\",\"https://test.domain.com/user?name=Linda&age=3\"]}"
    );
    assert.equal(configurationSettings[2].key, "testprefix/testKey3");
    assert.equal(configurationSettings[2].label, "testLabel");
    assert.equal(configurationSettings[2].tags, testTag);
    assert.equal(configurationSettings[2].value, "{\"testSubKey3\":\"30\"}");
  });

  it("Invalid key name, throw Argument Error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/NestedDeepKeyValue.json")).toString(),
      format: ConfigurationFormat.Json,
      prefix: "%"
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Parse simple key value yaml file", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/appconfigdata.yaml")).toString(),
      format: ConfigurationFormat.Yaml
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 1);
    assert.equal(configurationSettings[0].key, "items");
    assert.equal(
      configurationSettings[0].value,
      "{\"key\":\"Beta\",\"value\":1.1,\"url\":\"https://localhost/test.aspx?value=1\"}"
    );
  });

  it("Parse simple key value yaml file, set separator and depth", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/appconfigdata.yaml")).toString(),
      format: ConfigurationFormat.Yaml,
      depth: 3,
      separator: "_"
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, "items_key");
    assert.equal(configurationSettings[0].value, "Beta");
    assert.equal(configurationSettings[1].key, "items_value");
    assert.equal(configurationSettings[1].value, "1.1");
    assert.equal(configurationSettings[2].key, "items_url");
    assert.equal(configurationSettings[2].value, "https://localhost/test.aspx?value=1");
  });

  it("Parse properties file, set separator and depth", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/configFile.properties")).toString(),
      format: ConfigurationFormat.Properties,
      depth: 3,
      separator: "_"
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
      "app.Settings.L.O.N.G.X.D.E.P.T.H.X.T.E.S.T.depthTestKey"
    );
    assert.equal(configurationSettings[2].value, "depthTestValue");
    assert.equal(configurationSettings[3].key, "app.Fruit.Strawberry");
    assert.equal(configurationSettings[3].value, "red");
    assert.equal(configurationSettings[4].key, "app.Fruit.berries.Blackberry");
    assert.equal(configurationSettings[4].value, "black");
    assert.equal(configurationSettings[5].key, "app.Fruit.berries.Blueberry");
    assert.equal(configurationSettings[5].value, "blue");
  });

  it("Parse nested key value json file with json contentType", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/NestedKeyValue.json")).toString(),
      format: ConfigurationFormat.Json,
      separator: ":",
      contentType: "application/json"
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, "testKey1:testSubKey1");
    assert.equal(configurationSettings[0].value, "\"testValue1\"");
    assert.equal(configurationSettings[1].key, "testKey2:testSubKey2");
    assert.equal(configurationSettings[1].value, "\"https://test.domain.com/user?name=Alice&age=18\"");
    assert.equal(configurationSettings[2].key, "testKey3:testSubKey3");
    assert.equal(configurationSettings[2].value, "\"30\"");
  });

  it("Parse nested key array json file with json contentType", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/NestedDeepKeyValue.json")).toString(),
      format: ConfigurationFormat.Json,
      separator: ":",
      depth: 2,
      contentType: "application/json"
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, "testKey1:testSubKey1");
    assert.equal(configurationSettings[0].value, "{\"subKey1\":{\"subKey1\":\"testValue1\"}}");
    assert.equal(configurationSettings[1].key, "testKey2:testSubKey2");
    assert.equal(configurationSettings[1].value, "[\"https://test.domain.com/user?name=Alice&age=18\",\"https://test.domain.com/user?name=Iris&age=19\",\"https://test.domain.com/user?name=Linda&age=3\"]");
    assert.equal(configurationSettings[2].key, "testKey3:testSubKey3");
    assert.equal(configurationSettings[2].value, "\"30\"");
  });

  it("Parse nested key array json file", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/NestedDeepKeyValue.json")).toString(),
      format: ConfigurationFormat.Json,
      separator: ":",
      depth: 2
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, "testKey1:testSubKey1");
    assert.equal(configurationSettings[0].value, "{\"subKey1\":{\"subKey1\":\"testValue1\"}}");
    assert.equal(configurationSettings[1].key, "testKey2:testSubKey2");
    assert.equal(configurationSettings[1].value, "[\"https://test.domain.com/user?name=Alice&age=18\",\"https://test.domain.com/user?name=Iris&age=19\",\"https://test.domain.com/user?name=Linda&age=3\"]");
    assert.equal(configurationSettings[2].key, "testKey3:testSubKey3");
    assert.equal(configurationSettings[2].value, "30");
  });

  it("Parse nested key array json file with arbitrary content type", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/NestedDeepKeyValue.json")).toString(),
      format: ConfigurationFormat.Json,
      separator: ":",
      depth: 2,
      contentType: "arbitrary.string"
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, "testKey1:testSubKey1");
    assert.equal(configurationSettings[0].value, "{\"subKey1\":{\"subKey1\":\"testValue1\"}}");
    assert.equal(configurationSettings[0].contentType, "arbitrary.string");
    assert.equal(configurationSettings[1].key, "testKey2:testSubKey2");
    assert.equal(configurationSettings[1].value, "[\"https://test.domain.com/user?name=Alice&age=18\",\"https://test.domain.com/user?name=Iris&age=19\",\"https://test.domain.com/user?name=Linda&age=3\"]");
    assert.equal(configurationSettings[1].contentType, "arbitrary.string");
    assert.equal(configurationSettings[2].key, "testKey3:testSubKey3");
    assert.equal(configurationSettings[2].value, "30");
    assert.equal(configurationSettings[2].contentType, "arbitrary.string");
  });

  it("Preserve arrays if content type is Json",async  () => { 
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/ArrayPreserve.json")).toString(),
      format: ConfigurationFormat.Json,
      separator: ":",
      contentType: "application/json"
    };

    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings[0].key, "testKey1");
    assert.equal(configurationSettings[0].value, "[\"testValue1\",\"testValue2\"]");
  });
  
  it("Ignore empty objects when content type is not JSON",async  () => { 
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/EmptyObjects.json")).toString(),
      format: ConfigurationFormat.Json,
      separator: ":",
      depth: 1
    };

    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 1);
    assert.equal(configurationSettings[0].key, "testKey3");
    assert.equal(configurationSettings[0].value, "{\"testSubKey3\":\"testValue3\"}");
  });
});
