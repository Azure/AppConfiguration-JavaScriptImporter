import { secretReferenceContentType } from "@azure/app-configuration";
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { ConfigurationFormat } from "../src/enums";
import { StringConfigurationSettingsSource } from "../src/settingsImport/stringConfigurationSettingsSource";

describe("Parse sercret reference file", () => {
  it("Parse secret reference file, get correct configurationSettings", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/secretReference.json")).toString(),
      format: ConfigurationFormat.Json,
      contentType: secretReferenceContentType
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();

    assert.equal(configurationSettings.length, 1);
    assert.equal(configurationSettings[0].key, "testKey1");
    assert.equal(configurationSettings[0].contentType, secretReferenceContentType);
    assert.equal(configurationSettings[0].value, "{\"uri\":\"https://testkeyvault.vault.azure.net/secrets/TestSecret\"}");  
  });

  it("Parse secret reference file, no uri specified", async () => {
    const options = {
      data: fs.readFileSync(path.join("__dirname", "../tests/sources/invalid/secretReference/invalidFormat.json")).toString(),
      format: ConfigurationFormat.Json,
      contentType: secretReferenceContentType
    };
    const stringConfigurationSource = new StringConfigurationSettingsSource(options);
    const configurationSettings = await stringConfigurationSource.GetConfigurationSettings();
    assert.equal(configurationSettings.length, 1);
    assert.equal(configurationSettings[0].key, "testKey");
    assert.equal(configurationSettings[0].contentType, secretReferenceContentType);
    assert.equal(configurationSettings[0].value, "\"someValue\"");  
  });
});
