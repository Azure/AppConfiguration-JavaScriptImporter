import { assert } from "chai";
import * as sinon from "sinon";
import { AppConfigurationClient, SetConfigurationSettingResponse, featureFlagContentType } from "@azure/app-configuration";
import { AppConfigurationImporter } from "../src/appConfigurationImporter";
import { ImportProgress } from "../src/models";
import { MockUpHttpHeaderLike, MockupResourceLike } from "./appConfigurationImporter.spec";
import { listConfigurationSettings, assertThrowAsync } from "./utlis";
import { IterableConfigurationSettingsSource } from "../src/settingsImport/iterableConfigurationSettingsSource";
import { ArgumentError, ImportMode } from "../src";

describe("Iterator configuration source test", () => {
  it("Successfully get configuration settings and override label and content type", async () => {
    const options = {
      data: listConfigurationSettings(),
      prefix: "testPrefix",
      label: "TestLabel",
      contentType: "text"
    };

    const IteratorConfigurationSettings = new IterableConfigurationSettingsSource(options);
    const configurationSettings = await IteratorConfigurationSettings.GetConfigurationSettings();
    assert.equal(configurationSettings.length, 6);
    assert.equal(configurationSettings[0].key, "testPrefixapp:Settings:FontSize");
    assert.equal(configurationSettings[0].label, "TestLabel");
    assert.equal(configurationSettings[0].contentType, "text");
    assert.equal(configurationSettings[1].key, "testPrefixapp:Settings:BackgroundColor");
    assert.equal(configurationSettings[1].label, "TestLabel");
    assert.equal(configurationSettings[1].contentType, "text");
  });

  it("Successfully import configuration settings and override label and content type", async () => {
    const headerLike = sinon.createStubInstance(MockUpHttpHeaderLike);
    const resourceLike = sinon.createStubInstance(MockupResourceLike);
    const mockedResponse: SetConfigurationSettingResponse = {
      key: "fakeKey",
      isReadOnly: false,
      _response: {
        status: 200,
        request: resourceLike,
        headers: headerLike,
        parsedHeaders: {},
        bodyAsText: "fakeBody"
      }
    };
    const AppConfigurationClientStub = sinon.createStubInstance(AppConfigurationClient);
    AppConfigurationClientStub.setConfigurationSetting.resolves(mockedResponse);
    AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);

    const options = {
      data: listConfigurationSettings(),
      prefix: "app:",
      label: "some",
      contentType: "application/json"
    };
    const iteratorConfigurationSettingsSource = new IterableConfigurationSettingsSource(options);
    let finished = 0;
    let total = 0;
    const reportImportProgress = (importProgress: ImportProgress) => {
      finished = importProgress.successCount;
      total = importProgress.importCount;
    };
    await appConfigurationImporter.Import(iteratorConfigurationSettingsSource, 3, false, reportImportProgress);
    assert.equal(finished, 6);
    assert.equal(total, 6);
  });

  it("Successfully import configuration settings and feature flags when import mode is all", async () => {
    const headerLike = sinon.createStubInstance(MockUpHttpHeaderLike);
    const resourceLike = sinon.createStubInstance(MockupResourceLike);
    const mockedResponse: SetConfigurationSettingResponse = {
      key: "fakeKey",
      isReadOnly: false,
      _response: {
        status: 200,
        request: resourceLike,
        headers: headerLike,
        parsedHeaders: {},
        bodyAsText: "fakeBody"
      }
    };
    const AppConfigurationClientStub = sinon.createStubInstance(AppConfigurationClient);
    AppConfigurationClientStub.setConfigurationSetting.resolves(mockedResponse);
    AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);

    const options = {
      data: listConfigurationSettings()
    };

    const iteratorConfigurationSettingsSource = new IterableConfigurationSettingsSource(options);
    let finished = 0;
    let total = 0;

    const reportImportProgress = (importProgress: ImportProgress) => {
      finished = importProgress.successCount;
      total = importProgress.importCount;
    };

    await appConfigurationImporter.Import(iteratorConfigurationSettingsSource, 3, false, reportImportProgress, ImportMode.All);
    assert.equal(finished, 6);
    assert.equal(total, 6);
  });

  it("Successfully import only changed configuration settings when import mode is Ignore-Match", async () => {
    const headerLike = sinon.createStubInstance(MockUpHttpHeaderLike);
    const resourceLike = sinon.createStubInstance(MockupResourceLike);
    const mockedResponse: SetConfigurationSettingResponse = {
      key: "fakeKey",
      isReadOnly: false,
      _response: {
        status: 200,
        request: resourceLike,
        headers: headerLike,
        parsedHeaders: {},
        bodyAsText: "fakeBody"
      }
    };
    const AppConfigurationClientStub = sinon.createStubInstance(AppConfigurationClient);
    AppConfigurationClientStub.setConfigurationSetting.resolves(mockedResponse);
    AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);

    const options = {
      data: listConfigurationSettings()
    };

    const iteratorConfigurationSettingsSource = new IterableConfigurationSettingsSource(options);
    let finished = 0;
    let total = 0;

    const reportImportProgress = (importProgress: ImportProgress) => {
      finished = importProgress.successCount;
      total = importProgress.importCount;
    };

    await appConfigurationImporter.Import(iteratorConfigurationSettingsSource, 3, false, reportImportProgress, ImportMode.IgnoreMatch); // Ignore-Match is default import mode
    assert.equal(finished, 0);
    assert.equal(total, 0);
  });

  it("Successfully get configuration settings and feature flags", async () => {
    const options = {
      data: listConfigurationSettings()
    };

    const IteratorConfigurationSettings = new IterableConfigurationSettingsSource(options);
    const configurationSettings = await IteratorConfigurationSettings.GetConfigurationSettings();
    assert.equal(configurationSettings.length, 6);
  });

  it("Successfully skip feature flags when skip feature flag is enabled", async () => {
    const options = {
      data: listConfigurationSettings(),
      skipFeatureFlags: true
    };

    const IteratorConfigurationSettings = new IterableConfigurationSettingsSource(options);
    const configurationSettings = await IteratorConfigurationSettings.GetConfigurationSettings();
    assert.equal(configurationSettings.length, 5);
  });

  it("Successfully append prefix to feature flag", async () => {
    const options = {
      data: listConfigurationSettings(),
      prefix: "TestPrefix:"
    };

    const IteratorConfigurationSettings = new IterableConfigurationSettingsSource(options);
    const configurationSettings = await IteratorConfigurationSettings.GetConfigurationSettings();
    assert.equal(configurationSettings.length, 6);
    assert.equal(configurationSettings[3].key, ".appconfig.featureflag/TestPrefix:Test");
    assert.equal(configurationSettings[3].contentType, featureFlagContentType);
  });

  it("Successfully trim prefix for configuration settings", async () => {
    const options = {
      data: listConfigurationSettings(),
      trimPrefix: "app:"
    };

    const IteratorConfigurationSettings = new IterableConfigurationSettingsSource(options);
    const configurationSettings = await IteratorConfigurationSettings.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 6);
    // Only trim prefix if its present in the key
    assert.equal(configurationSettings[0].key, "Settings:FontSize");
    assert.equal(configurationSettings[1].key, "Settings:BackgroundColor");
    assert.equal(configurationSettings[2].key, "Settings:FontColor");
    assert.equal(configurationSettings[3].key, ".appconfig.featureflag/Test");
    assert.equal(configurationSettings[4].key, "TestEnv");
    assert.equal(configurationSettings[5].key, "Database:ConnectionString");
  });

  it("Successfully trim prefix for configuration settings and append prefix", async () => {
    const options = {
      data: listConfigurationSettings(),
      trimPrefix: "app:",
      prefix: "test:"
    };

    const IteratorConfigurationSettings = new IterableConfigurationSettingsSource(options);
    const configurationSettings = await IteratorConfigurationSettings.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 6);

    assert.equal(configurationSettings[0].key, "test:Settings:FontSize");
    assert.equal(configurationSettings[1].key, "test:Settings:BackgroundColor");
    assert.equal(configurationSettings[2].key, "test:Settings:FontColor");
  });
  
  it("Successfully trim prefix for feature flags and append prefix", async () => {
    const options = {
      data: listConfigurationSettings(),
      trimPrefix: "Test",
      prefix: "FeatureA:Beta"
    };

    const IteratorConfigurationSettings = new IterableConfigurationSettingsSource(options);
    const configurationSettings = await IteratorConfigurationSettings.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 6);

    assert.equal(configurationSettings[3].key, ".appconfig.featureflag/FeatureA:Beta");
  });

  it("Throw for invalid key prefix", async () => {
    const options = {
      data: listConfigurationSettings(),
      prefix: "%",
      label: "some",
      contentType: "application/json"
    };

    const IteratorConfigurationSettings = new IterableConfigurationSettingsSource(options);
    assertThrowAsync(() => IteratorConfigurationSettings.GetConfigurationSettings(), ArgumentError);
  });
});