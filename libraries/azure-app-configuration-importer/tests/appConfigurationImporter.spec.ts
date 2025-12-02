// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert, expect } from "chai";
import * as path from "path";
import * as fs from "fs";
import { ConfigurationFormat, ConfigurationProfile, ImportMode } from "../src/enums";
import { StringConfigurationSettingsSource } from "../src/settingsImport/stringConfigurationSettingsSource";
import { ConfigurationChangesSource } from "../src/settingsImport/configurationChangesSource";
import { 
  AppConfigurationClient, 
  ConfigurationSetting, 
  DeleteConfigurationSettingResponse,
  SetConfigurationSettingResponse } from "@azure/app-configuration";
import { AppConfigurationImporter  } from "../src/appConfigurationImporter";
import * as sinon from "sinon";
import { AbortSignalLike, HttpHeader, HttpHeadersLike, HttpMethods, HttpOperationResponse, OperationResponse, OperationSpec, ProxySettings, RawHttpHeaders, RequestPrepareOptions, TransferProgressEvent, WebResourceLike, RestError } from "@azure/core-http";
import { ImportProgress } from "../src/models";
import { OperationTimeoutError } from "../src";
import { listConfigurationSettings } from "./utlis";
import { ArgumentError } from "../src/errors";

describe("Call Import API to import configuration file to AppConfiguration", () => {
  it("Succeed to import simple key value file", async () => {
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
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/simpleKeyValue.json")).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    let finished = 0;
    let total = 0;
    const reportImportProgress = (importProgress: ImportProgress) => {
      finished = importProgress.successCount;
      total = importProgress.importCount;
    };
    await appConfigurationImporter.Import(stringConfigurationSource, { timeout: 3, progressCallback: reportImportProgress, strict: false });
    assert.equal(finished, 3);
    assert.equal(total, 3);
  });

  it("Fail to import because of server error", async () => {
    const AppConfigurationClientStub = sinon.createStubInstance(AppConfigurationClient);
    AppConfigurationClientStub.setConfigurationSetting.throws(new RestError("server error", "server error", 500));
    AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);

    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/simpleKeyValue.json")).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const importPromise = appConfigurationImporter.Import(stringConfigurationSource, { timeout: 1, strict: false });
    importPromise.catch((e) => {
      expect(e.message).to.eq("server error"); 
    });
  });

  it("Fail to import because of timeout", async () => {
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
    AppConfigurationClientStub.setConfigurationSetting.callsFake(async () => {
      await new Promise(res => setTimeout(res, 2000));
      return mockedResponse;
    });
    AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);

    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/simpleKeyValue.json")).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    try {
      await appConfigurationImporter.Import(stringConfigurationSource, { timeout: 1, strict: false });
    }
    catch (error) {
      assert.isTrue(error instanceof OperationTimeoutError);
    }
    // assert.throw(async () => await syncClient.Import(stringConfigurationSource, 1, false), ImportTimeoutError);
  });

  it("Success to import after surviving from client throttle", async () => {
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
    const fakeThrottledError = new RestError("client throttled", "429", 429);
    AppConfigurationClientStub.setConfigurationSetting.onCall(0).throws(fakeThrottledError);
    AppConfigurationClientStub.setConfigurationSetting.onCall(1).throws(fakeThrottledError);
    AppConfigurationClientStub.setConfigurationSetting.onCall(2).throws(fakeThrottledError);
    AppConfigurationClientStub.setConfigurationSetting.resolves(mockedResponse);
    AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);

    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/simpleKeyValue.json")).toString(),
      format: ConfigurationFormat.Json
    };
    let finished = 0;
    let total = 0;
    const reportImportProgress = (importProgress: ImportProgress) => {
      finished = importProgress.successCount;
      total = importProgress.importCount;
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    await appConfigurationImporter.Import(stringConfigurationSource, { timeout: 10, progressCallback: reportImportProgress, strict: false });
    assert.equal(finished, 3);
    assert.equal(total, 3);
  });

  it("Try import an empty file, no error", async () => {
    const AppConfigurationClientStub = sinon.createStubInstance(AppConfigurationClient);
    AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);

    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/empty.json")).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    await appConfigurationImporter.Import(stringConfigurationSource, { timeout: 10, strict: false });
  });

  it("Try import an empty file, no error", async () => {
    const AppConfigurationClientStub = sinon.createStubInstance(AppConfigurationClient);
    AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);

    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/empty.json")).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    await appConfigurationImporter.Import(stringConfigurationSource, { timeout: 10, strict: false });
  });

  it("Succeed to import simple key value file in strict mode", async () => {
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
    const mockedDeleteResponse: DeleteConfigurationSettingResponse = {
      _response: {
        status: 200,
        request: resourceLike,
        headers: headerLike,
        parsedHeaders: {},
        bodyAsText: "fakeBody"
      },
      statusCode: 200
    };
    const configurationsToDelete: ConfigurationSetting[] = [];
    configurationsToDelete.push({
      key: "toDelete",
      isReadOnly: false
    });

    const AppConfigurationClientStub = sinon.createStubInstance(AppConfigurationClient);
    AppConfigurationClientStub.setConfigurationSetting.resolves(mockedResponse);
    AppConfigurationClientStub.deleteConfigurationSetting.resolves(mockedDeleteResponse);
    AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);
    const exampleProto = Object.getPrototypeOf(appConfigurationImporter);
    exampleProto.getSettingsToDelete = ()=>{
      return configurationsToDelete;
    };

    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/simpleKeyValue.json")).toString(),
      format: ConfigurationFormat.Json
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    let finished = 0;
    let total = 0;
    const reportImportProgress = (importProgress: ImportProgress) => {
      finished = importProgress.successCount;
      total = importProgress.importCount;
    };
    await appConfigurationImporter.Import(stringConfigurationSource, { timeout: 10, progressCallback: reportImportProgress, strict: false });
    assert.equal(finished, 3);
    assert.equal(total, 3);
  });

  it("Succeed to import configuration changes with Import API", async () => {
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
    const mockedDeleteResponse: DeleteConfigurationSettingResponse = {
      _response: {
        status: 200,
        request: resourceLike,
        headers: headerLike,
        parsedHeaders: {},
        bodyAsText: "fakeBody"
      },
      statusCode: 200
    };

    const AppConfigurationClientStub = sinon.createStubInstance(AppConfigurationClient);
    AppConfigurationClientStub.setConfigurationSetting.resolves(mockedResponse);
    AppConfigurationClientStub.deleteConfigurationSetting.resolves(mockedDeleteResponse);
    AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);

    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/default.json")).toString(),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.Default,
      label: "Dev",
      separator: ":"
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    
    // Call GetConfigurationChanges to get the changes we would import
    const configurationChanges = await appConfigurationImporter.GetConfigurationChanges(
      stringConfigurationSource, 
      false, 
      ImportMode.All
    );

    assert.equal(configurationChanges.ToAdd.length, 2);
    assert.equal(configurationChanges.ToModify.length, 1);
    assert.equal(configurationChanges.ToDelete.length, 0);
    assert.equal(configurationChanges.ToModify[0].key, "app:Settings:FontColor");

    let finished = 0;
    let total = 0;
    const reportImportProgress = (importProgress: ImportProgress) => {
      finished = importProgress.successCount;
      total = importProgress.importCount;
    };

    // Use Import API with pre-calculated changes
    const changesSourceForTest = new ConfigurationChangesSource(configurationChanges);
    await appConfigurationImporter.Import(changesSourceForTest, { timeout: 5, progressCallback: reportImportProgress });
    assert.equal(finished, 3);
    assert.equal(total, 3);
  });

  it("Fail to import ConfigurationChangesSource when both strict and importMode parameters are provided", async () => {
    const AppConfigurationClientStub = sinon.createStubInstance(AppConfigurationClient);
    const appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);

    const configurationChanges = {
      ToAdd: [{ key: "testKey", value: "testValue" }],
      ToModify: [],
      ToDelete: []
    };
    
    const changesSource = new ConfigurationChangesSource(configurationChanges);

    try {
      await appConfigurationImporter.Import(changesSource, { timeout: 5, strict: true, importMode: ImportMode.All });
    }
    catch (error) {
      expect(error).to.be.instanceOf(ArgumentError);
      expect((error as ArgumentError).message).to.contain("Parameters 'strict' and 'importMode' are not applicable when importing pre-calculated changes");
    }
  });

  describe("Call GetConfigurationChanges API to get configurations changes from file and pass Import mode options", () => {
    let appConfigurationImporter: AppConfigurationImporter;

    beforeEach(function () {
      const AppConfigurationClientStub = sinon.createStubInstance(AppConfigurationClient);
      AppConfigurationClientStub.listConfigurationSettings.returns(listConfigurationSettings());
      appConfigurationImporter = new AppConfigurationImporter(AppConfigurationClientStub);
    });

    it("Succeed to get configuration changes with importMode as All, profile as default", async () => {
      const options = {
        data: fs.readFileSync(path.join("__dirname", "../tests/sources/default.json")).toString(),
        format: ConfigurationFormat.Json,
        profile: ConfigurationProfile.Default,
        label: "Dev",
        separator: ":"
      };
      const stringConfigurationSource = new StringConfigurationSettingsSource(options);
      const configurationChanges = await appConfigurationImporter.GetConfigurationChanges(stringConfigurationSource, false, ImportMode.All);
      assert.equal(configurationChanges.ToAdd.length, 2);
      assert.equal(configurationChanges.ToModify.length, 1);
      assert.equal(configurationChanges.ToDelete.length, 0);
      assert.equal(configurationChanges.ToModify[0].key, "app:Settings:FontColor");
    });

    it("Succeed to get configuration changes and return no matching key values updates with importMode as IgnoreMatch and profile as default", async () => {
      const options = {
        data: fs.readFileSync(path.join("__dirname", "../tests/sources/default.json")).toString(),
        format: ConfigurationFormat.Json,
        profile: ConfigurationProfile.Default,
        label: "Dev",
        separator: ":"
      };
      const source = new StringConfigurationSettingsSource(options);
      const configurationChanges = await appConfigurationImporter.GetConfigurationChanges(source, false, ImportMode.IgnoreMatch);
      // Only keys with no matching key-values in App Configuration will be updated
      assert.equal(configurationChanges.ToAdd.length, 0);
      assert.equal(configurationChanges.ToModify.length, 1);
      assert.equal(configurationChanges.ToModify[0].key, "app:Settings:FontColor");
      assert.equal(configurationChanges.ToDelete.length, 0);
    });

    it("Succeed to get configuration changes from key-values file with importMode as All and profile as kvset", async () => {
      const options = {
        data: fs.readFileSync(path.join("__dirname", "../tests/sources/kvset.json")).toString(),
        format: ConfigurationFormat.Json,
        profile: ConfigurationProfile.KvSet
      };
      const stringConfigurationSource = new StringConfigurationSettingsSource(options);
      const configurationChanges = await appConfigurationImporter.GetConfigurationChanges(stringConfigurationSource, false, ImportMode.All);
      // All key-values in App Configuration will be updated
      assert.equal(configurationChanges.ToAdd.length, 2);
      assert.equal(configurationChanges.ToModify.length, 1);
      assert.equal(configurationChanges.ToModify[0].key, "TestEnv");
      assert.equal(configurationChanges.ToDelete.length, 0);
    });

    it("Succeed to get configuration changes and return no matching key values with importMode as IgnoreMatch and profile as kvset", async () => {
      const options = {
        data: fs.readFileSync(path.join("__dirname", "../tests/sources/kvset.json")).toString(),
        format: ConfigurationFormat.Json,
        profile: ConfigurationProfile.KvSet
      };
      const source = new StringConfigurationSettingsSource(options);
      const configurationChanges = await appConfigurationImporter.GetConfigurationChanges(source, false, ImportMode.IgnoreMatch);
      // Only changed key (TestEnv) should be in ToModify
      assert.equal(configurationChanges.ToAdd.length, 0);
      assert.equal(configurationChanges.ToModify.length, 1);
      assert.equal(configurationChanges.ToModify[0].key, "TestEnv");
      assert.equal(configurationChanges.ToDelete.length, 0);
    });

    it("Fail when an invalid import mode is provided", async () => {
      const options = {
        data: fs.readFileSync(path.join("__dirname", "../tests/sources/kvset.json")).toString(),
        format: ConfigurationFormat.Json,
        profile: ConfigurationProfile.KvSet
      };
      const stringConfigurationSource = new StringConfigurationSettingsSource(options);

      try {
        await appConfigurationImporter.GetConfigurationChanges(stringConfigurationSource, false, 9 as unknown as ImportMode);
      }
      catch (error) {
        assert.isTrue(error instanceof ArgumentError);
        if (error instanceof ArgumentError) {
          assert.equal(error.message, "Only options supported for Import Mode are 'All' and 'Ignore-Match'.");
        }
      }
    });
  });
});

export class MockUpHttpHeaderLike implements HttpHeadersLike {
  set(headerName: string, headerValue: string | number): void {
    console.log(headerName);
    console.log(headerValue);
    throw new Error("Method not implemented.");
  }
  get(headerName: string): string | undefined {
    console.log(headerName);
    throw new Error("Method not implemented.");
  }
  contains(headerName: string): boolean {
    console.log(headerName);
    throw new Error("Method not implemented.");
  }
  remove(headerName: string): boolean {
    console.log(headerName);
    throw new Error("Method not implemented.");
  }
  rawHeaders(): RawHttpHeaders {
    throw new Error("Method not implemented.");
  }
  headersArray(): HttpHeader[] {
    throw new Error("Method not implemented.");
  }
  headerNames(): string[] {
    throw new Error("Method not implemented.");
  }
  headerValues(): string[] {
    throw new Error("Method not implemented.");
  }
  clone(): HttpHeadersLike {
    throw new Error("Method not implemented.");
  }
  toJson(options?: { preserveCase?: boolean | undefined; }): RawHttpHeaders {
    console.log(options);
    throw new Error("Method not implemented.");
  }
}

export class MockupResourceLike implements WebResourceLike {
  url!: string;
  method!: HttpMethods;
  body?: any;
  headers!: HttpHeadersLike;
  streamResponseBody?: boolean | undefined;
  streamResponseStatusCodes?: Set<number> | undefined;
  shouldDeserialize?: boolean | ((response: HttpOperationResponse) => boolean) | undefined;
  operationResponseGetter?: ((operationSpec: OperationSpec, response: HttpOperationResponse) => OperationResponse | undefined) | undefined;
  formData?: any;
  query?: { [key: string]: any; } | undefined;
  operationSpec?: OperationSpec | undefined;
  withCredentials!: boolean;
  timeout!: number;
  proxySettings?: ProxySettings | undefined;
  keepAlive?: boolean | undefined;
  decompressResponse?: boolean | undefined;
  requestId!: string;
  abortSignal?: AbortSignalLike | undefined;
  onUploadProgress?: ((progress: TransferProgressEvent) => void) | undefined;
  onDownloadProgress?: ((progress: TransferProgressEvent) => void) | undefined;
  validateRequestProperties(): void {
    throw new Error("Method not implemented.");
  }
  prepare(options: RequestPrepareOptions): WebResourceLike {
    console.log(options);
    throw new Error("Method not implemented.");
  }
  clone(): WebResourceLike {
    throw new Error("Method not implemented.");
  }
}
