import { ConfigurationSetting, ListConfigurationSettingPage } from "@azure/app-configuration";
import { PagedAsyncIterableIterator, PageSettings } from "@azure/core-paging";
import * as sinon from "sinon";
import { assert } from "chai";
import { MockupResourceLike, MockUpHttpHeaderLike } from "./AppConfigurationImporter.spec";

const items: ConfigurationSetting[] = [
  {
    key: "app:Settings:FontSize",
    label: "Dev",
    contentType: undefined,
    value: "45",
    lastModified: undefined,
    etag: "",
    isReadOnly: false
  },
  {
    key: "app:Settings:BackgroundColor",
    label: "Dev",
    contentType: undefined,
    value: "yellow",
    lastModified: undefined,
    tags: {},
    etag: "",
    isReadOnly: false
  },
  {
    key: "app:Settings:FontColor",
    label: "Dev",
    contentType: undefined,
    value: "yellow",
    lastModified: undefined,
    tags: {
      tag1: "value1",
      tag2: "value2"
    },
    etag: "",
    isReadOnly: false
  },
  {
    key: ".appconfig.featureflag/Test",
    label: "dev",
    contentType: "application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
    value: "{\"id\":\"Test\",\"description\":\"Test feature\",\"enabled\":true,\"conditions\":{\"client_filters\":[]}}",
    lastModified: undefined,
    tags: {},
    etag: "",
    isReadOnly: false
  },
  {
    key: "TestEnv",
    label: "dev",
    contentType: undefined,
    value: "Debug",
    lastModified: undefined,
    tags: {
      tag1: "value1",
      tag2: "value3"
    },
    etag: "",
    isReadOnly: false
  },
  {
    key: "Database:ConnectionString",
    label: "test",
    contentType: "application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8",
    value: "{\"uri\":\"https://keyvault.vault.azure.net/secrets/db-secret\"}",
    lastModified: undefined,
    etag: "",
    isReadOnly: false
  }
];

export function listConfigurationSettings(): PagedAsyncIterableIterator<ConfigurationSetting<string>, ListConfigurationSettingPage, PageSettings> {
  const iter = getListConfigurationSettingsIterator();
  return {
    next() {
      return iter.next();
    },
    [Symbol.asyncIterator]() {
      return this;
    },
    byPage: (): AsyncIterableIterator<ListConfigurationSettingPage>=> {
      return getListConfigurationSettingPage();
    }
  };
}

export async function assertThrowAsync(asyncFunction:() => any, error: any): Promise<void> {
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

async function *getListConfigurationSettingsIterator(): AsyncIterableIterator<ConfigurationSetting> {
  for (const setting of items) {
    yield setting;
  }
}

async function *getListConfigurationSettingPage():AsyncGenerator<ListConfigurationSettingPage>{
  const headerLike = sinon.createStubInstance(MockUpHttpHeaderLike);
  const resourceLike = sinon.createStubInstance(MockupResourceLike);

  const response: ListConfigurationSettingPage = {
    _response: {
      status: 200,
      request: resourceLike,
      headers: headerLike,
      parsedHeaders: {},
      bodyAsText: "fakeBody"
    },
    items: items,
    continuationToken: ""
  };

  yield response;
}