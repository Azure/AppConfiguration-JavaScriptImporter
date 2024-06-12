import { FeatureFlagValue, featureFlagContentType, secretReferenceContentType, AppConfigurationClient } from "@azure/app-configuration";
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as sinon from "sinon";
import { ConfigurationFormat, ConfigurationProfile, ImportMode } from "../src/enums";
import { ArgumentError } from "../src/errors";
import { StringConfigurationSettingsSource } from "../src/settingsImport/StringConfigurationSettingsSource";
import { JsonSecretReferenceValue } from "../src/models";
import { AppConfigurationImporter } from "../src/AppConfigurationImporter";
import { listConfigurationSettings, assertThrowAsync } from "./utlis";

describe("Parse kvset format file", () => {
  it("Parse kvset format file, get correct configurationSettings", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/kvset.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, ".appconfig.featureflag/Test");
    assert.equal(configurationSettings[0].contentType, featureFlagContentType);
    assert.equal(configurationSettings[0].label, "dev");
    const featureFlag = JSON.parse(configurationSettings[0].value as string) as FeatureFlagValue;
    assert.equal(featureFlag.id, "Test");
    assert.equal(JSON.stringify(featureFlag.conditions), "{\"client_filters\":[]}");
    assert.isTrue(featureFlag.enabled);

    assert.equal(configurationSettings[1].key, "Database:ConnectionString");
    assert.equal(configurationSettings[1].contentType, secretReferenceContentType);
    assert.equal(configurationSettings[1].label, "test");
    const secret = JSON.parse(configurationSettings[1].value as string) as JsonSecretReferenceValue;
    assert.equal(secret.uri, "https://keyvault.vault.azure.net/secrets/db-secret");

    assert.equal(configurationSettings[2].key, "TestEnv");
    assert.equal(configurationSettings[2].value, "Debug");
    assert.equal(configurationSettings[2].contentType, null);
    assert.equal(configurationSettings[2].label, "dev");
    assert.equal(JSON.stringify(configurationSettings[2].tags), "{\"tag1\":\"value1\",\"tag2\":\"value2\"}");
  });

  
  it("Parse kvset format file, get error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/kvset/invalidKvSetKey.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    
    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Parse invalid kvset format file, get error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/kvset/invalidKvSetObj.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    
    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });


  it("Parse invalid key file, get error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/kvset/invalidKvSetKey.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    
    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Parse invalid kvset format schema file, get error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/kvset/invalidKvSetSchema.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);

    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Parse kvset file with invalid field, just ignore it, no error thrown", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/kvset/invalidKvSetField.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();
    assert.equal(configurationSettings.length, 1);
    assert.equal(configurationSettings[0].key, ".appconfig.featureflag/Test");
    assert.equal(configurationSettings[0].contentType, featureFlagContentType);
    assert.equal(configurationSettings[0].label, "dev");
    const featureFlag = JSON.parse(configurationSettings[0].value as string) as FeatureFlagValue;
    assert.equal(featureFlag.id, "Test");
    assert.equal(JSON.stringify(featureFlag.conditions), "{\"client_filters\":[]}");
    assert.isTrue(featureFlag.enabled);
  });

  it("Parse kvset file with invalid tag, should throw correct error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/kvset/invalidKvSetTags.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Parse kvset file with invalid key name, should throw correct error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/kvset/invalidKvSetKeyName.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Parse kvset file with invalid key object, should throw correct error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/kvset/invalidKvSetKeyName2.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Parse kvset file with invalid key with feature flag prefix, should throw correct error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/kvset/invalidKvSetKeyName3.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Parse kvset file with invalid label, should throw correct error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/kvset/invalidKvSetLabel.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Parse kvset file with invalid content_type, should throw correct error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/kvset/invalidKvSetContentType.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Parse kvset file with invalid value, should throw correct error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/kvset/invalidKvSetValue.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    assertThrowAsync(() => stringConfigurationSource.GetConfigurationSettings(), ArgumentError);
  });

  it("Does not support parse kvset yaml file, throw error", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/KvSetYaml.yaml")).toString(),
      format: ConfigurationFormat.Yaml,
      profile: ConfigurationProfile.KvSet
    };

    assert.throw(()=> new StringConfigurationSettingsSource(options), ArgumentError);
  });

  it("Delete key-values present in the store but not available in the config file", async()=>{
    const spy = sinon.spy(console,"log");
    const AppConfigurationClientStub = sinon.createStubInstance(AppConfigurationClient);
    AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/kvset.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    await appConfigurationImporter.Import(stringConfigurationSource, 3, true, undefined, ImportMode.All, true);
   
    // The keys present in the store and not in the configuration file are deleted if strict is set to true
    assert.equal(spy.getCall(0).args[0], "The following settings will be removed from App Configuration:");
    assert.equal(spy.getCall(1).args[0], "{\"key\":\"app:Settings:FontSize\",\"label\":\"Dev\"}");
    assert.equal(spy.getCall(2).args[0], "{\"key\":\"app:Settings:BackgroundColor\",\"label\":\"Dev\",\"tags\":{}}");
    assert.equal(spy.getCall(3).args[0], "{\"key\":\"app:Settings:FontColor\",\"label\":\"Dev\",\"tags\":{\"tag1\":\"value1\",\"tag2\":\"value2\"}}");
    spy.restore();
  });

  it("Delete key-values present in the store but not available in the config file, with similar key but different label", async()=>{
    const spy = sinon.spy(console,"log");
    const AppConfigurationClientStub = sinon.createStubInstance(AppConfigurationClient);
    AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/kvsetWithDiffLabel.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    };
    
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    await appConfigurationImporter.Import(stringConfigurationSource, 3, true, undefined, ImportMode.All, true);
   
    // The keys present in the store and not in the configuration file are deleted if strict is set to true
    assert.equal(spy.getCall(0).args[0], "The following settings will be removed from App Configuration:");
    assert.equal(spy.getCall(1).args[0], "{\"key\":\"app:Settings:FontSize\",\"label\":\"Dev\"}");
    assert.equal(spy.getCall(2).args[0], "{\"key\":\"app:Settings:BackgroundColor\",\"label\":\"Dev\",\"tags\":{}}");
    assert.equal(spy.getCall(3).args[0], "{\"key\":\"app:Settings:FontColor\",\"label\":\"Dev\",\"tags\":{\"tag1\":\"value1\",\"tag2\":\"value2\"}}");
    assert.equal(spy.getCall(4).args[0], "{\"key\":\".appconfig.featureflag/Test\",\"label\":\"dev\",\"contentType\":\"application/vnd.microsoft.appconfig.ff+json;charset=utf-8\",\"tags\":{}}");
    assert.equal(spy.getCall(5).args[0], "{\"key\":\"Database:ConnectionString\",\"label\":\"test\",\"contentType\":\"application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8\"}");
    spy.restore();
  });
});
