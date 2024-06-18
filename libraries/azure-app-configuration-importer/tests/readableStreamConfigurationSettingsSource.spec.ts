import { assert } from "chai";
import * as path from "path";
import * as fs from "fs";
import * as sinon from "sinon";
import { AppConfigurationClient, SetConfigurationSettingResponse } from "@azure/app-configuration";
import { ImportProgress } from "../src/models";
import { AppConfigurationImporter } from "../src/appConfigurationImporter";
import { MockUpHttpHeaderLike, MockupResourceLike } from "./appConfigurationImporter.spec";
import { ConfigurationFormat, ConfigurationProfile } from "../src/enums";
import { ReadableStreamConfigurationSettingsSource } from "../src/settingsImport/readableStreamConfigurationSettingsSource";
import  { ReadableStreamSourceOptions } from "../src/importOptions";
import { assertThrowAsync, listConfigurationSettings } from "./utlis";
import { ParseError } from "../src/errors";

describe("Readable stream configuration settings source tests", () => {
  it("Successfully get configuration settings from readable stream source, json file", async () => {
    const filePath = path.join("__dirname", "../tests/sources/simpleKeyValue.json");
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        fs.readFile(filePath, { encoding: "utf8" }, (err, data) => {
          if (err) {
            controller.error(err);
          }
          else {
            controller.enqueue(encoder.encode(data));
            controller.close();
          }
        });
      }
    });

    const options: ReadableStreamSourceOptions  = {
      format : ConfigurationFormat.Json,
      profile : ConfigurationProfile.Default,
      data : readableStream
    };
    const readableConfigurationSettingsSource = new ReadableStreamConfigurationSettingsSource(options);
    const configurationSettings = await readableConfigurationSettingsSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, "testKey1");
    assert.equal(configurationSettings[0].value, "testValue1");
    assert.equal(configurationSettings[1].key, "testKey2");
    assert.equal(configurationSettings[1].value, "https://test.domain.com/user?name=Alice&age=18");
    assert.equal(configurationSettings[2].key, "testKey3");
    assert.equal(configurationSettings[2].value, "30");
  });

  it("Successfully get configuration settings from readable stream source, yaml file", async () => {
    const filePath = path.join("__dirname", "../tests/sources/featureFlags.yaml");
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        fs.readFile(filePath, { encoding: "utf8" }, (err, data) => {
          if (err) {
            controller.error(err);
          }
          else {
            controller.enqueue(encoder.encode(data));
            controller.close();
          }
        });
      }
    });

    const options: ReadableStreamSourceOptions  = {
      format : ConfigurationFormat.Yaml,
      profile : ConfigurationProfile.Default,
      data : readableStream
    };
    const readableConfigurationSettingsSource = new ReadableStreamConfigurationSettingsSource(options);
    const configurationSettings = await readableConfigurationSettingsSource.GetConfigurationSettings();
        
    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, ".appconfig.featureflag/FeatureT");
    assert.equal(configurationSettings[1].key, ".appconfig.featureflag/FeatureU");
    assert.equal(configurationSettings[2].key, ".appconfig.featureflag/FeatureV");
  });

  it("Successfully get configuration settings from large readable stream source with 5000 kvs", async () => {
    const filePath = path.join("__dirname", "../tests/sources/largeFile5K.json");
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const stream = fs.createReadStream(filePath, { encoding: "utf8"});
        stream.on("data", (chunk) => {
          controller.enqueue(encoder.encode(chunk.toString()));
        });

        stream.on("end", () => {
          controller.close();
        });

        stream.on("error", (err) => controller.error(err));
      }
    });

    const options: ReadableStreamSourceOptions  = {
      format : ConfigurationFormat.Json,
      profile : ConfigurationProfile.Default,
      separator: ":",
      depth: 6,
      data : readableStream
    };
    const readableConfigurationSettingsSource = new ReadableStreamConfigurationSettingsSource(options);
    const configurationSettings = await readableConfigurationSettingsSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 5000);
  });

  it("Successfully import configuration settings from readable stream source", async () => {
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

    const filePath = path.join("__dirname", "../tests/sources/simpleKeyValue.json");
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        fs.readFile(filePath, { encoding: "utf8" }, (err, data) => {
          if (err) {
            controller.error(err);
          }
          else {
            controller.enqueue(encoder.encode(data));
            controller.close();
          }
        });
      }
    });

    const options: ReadableStreamSourceOptions  = {
      format : ConfigurationFormat.Json,
      profile : ConfigurationProfile.Default,
      data : readableStream
    };

    const readableConfigurationSettingsSource = new ReadableStreamConfigurationSettingsSource(options);
        
    let finished = 0;
    let total = 0;
    const reportImportProgress = (importProgress: ImportProgress) => {
      finished = importProgress.successCount;
      total = importProgress.importCount;
    };
    await appConfigurationImporter.Import(readableConfigurationSettingsSource, 3, false, reportImportProgress);
    assert.equal(finished, 3);
    assert.equal(total, 3);
  });

  it("Successfully get configuration settings from readable stream source(Node JS), json file", async () => {
    const filePath = path.join("__dirname", "../tests/sources/simpleKeyValue.json");

    const readableStream = fs.createReadStream(filePath);
    
    const options: ReadableStreamSourceOptions  = {
      format : ConfigurationFormat.Json,
      profile : ConfigurationProfile.Default,
      data : readableStream
    };
    const readableConfigurationSettingsSource = new ReadableStreamConfigurationSettingsSource(options);
    const configurationSettings = await readableConfigurationSettingsSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 3);
    assert.equal(configurationSettings[0].key, "testKey1");
    assert.equal(configurationSettings[0].value, "testValue1");
    assert.equal(configurationSettings[1].key, "testKey2");
    assert.equal(configurationSettings[1].value, "https://test.domain.com/user?name=Alice&age=18");
    assert.equal(configurationSettings[2].key, "testKey3");
    assert.equal(configurationSettings[2].value, "30");
  });

  it("Throw error if the readable stream is not utf8", async () => {
    const filePath = path.join("__dirname", "../tests/sources/invalid/notUTF8.json");
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        fs.readFile(filePath, { encoding: "base64" }, (err, data) => {
          if (err) {
            controller.error(err);
          }
          else {
            controller.enqueue(encoder.encode(data));
            controller.close();
          }
        });
      }
    });

    const options: ReadableStreamSourceOptions  = {
      format : ConfigurationFormat.Json,
      profile : ConfigurationProfile.Default,
      data : readableStream
    };

    const readableConfigurationSettingsSource = new ReadableStreamConfigurationSettingsSource(options);
    assertThrowAsync(() => readableConfigurationSettingsSource.GetConfigurationSettings(), ParseError);
  });
});