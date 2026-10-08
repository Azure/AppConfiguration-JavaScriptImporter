// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert } from "chai";
import * as path from "path";
import { ArgumentError, ArgumentNullError, ConfigurationFormat, ConfigurationProfile } from "@azure/app-configuration-importer";
import { FileFeatureFlagSource } from "../src/fileFeatureFlagSource";

describe("File feature flag source test", () => {
  it("Reads enhanced feature flags from an ffset file", async () => {
    const source = new FileFeatureFlagSource({
      filePath: path.join("__dirname", "../tests/sources/ffset.json"),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.FfSet
    });

    const featureFlags = await source.GetFeatureFlags();

    assert.deepEqual(featureFlags, [
      { name: "Checkout", label: "Production", enabled: true, conditions: { filters: [] } },
      { name: "DarkMode", enabled: false }
    ]);
    assert.deepEqual(source.FeatureFlagFilterOptions, { nameFilter: "*", labelFilter: "*" });
  });

  it("Reads enhanced feature flags from a Default MS FM file", async () => {
    const source = new FileFeatureFlagSource({
      filePath: path.join("__dirname", "../tests/sources/featureFlagsMsFmSchema.json"),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.Default,
      label: "Production"
    });

    const featureFlags = await source.GetFeatureFlags();

    assert.equal(featureFlags.length, 1);
    assert.equal(featureFlags[0].name, "Checkout");
    assert.equal(featureFlags[0].label, "Production");
    assert.equal(featureFlags[0].enabled, true);
    assert.deepEqual(source.FeatureFlagFilterOptions, { nameFilter: undefined, labelFilter: "Production" });
  });

  it("Throws a wrapped error when the file cannot be read", async () => {
    const source = new FileFeatureFlagSource({
      filePath: path.join("__dirname", "../tests/sources/doesNotExist.json"),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.FfSet
    });

    let errorThrown: any;
    try {
      await source.GetFeatureFlags();
    }
    catch (error) {
      errorThrown = error;
    }

    assert.isDefined(errorThrown);
    assert.include(errorThrown.message, "Error while importing enhanced feature flags from");
  });

  it("Throws when fileOptions is not provided", () => {
    assert.throw(() => new FileFeatureFlagSource(undefined as any), ArgumentNullError);
  });

  it("Throws when filePath is empty or whitespace", () => {
    assert.throw(() => new FileFeatureFlagSource({
      filePath: "",
      format: ConfigurationFormat.Json
    }), ArgumentNullError);
    assert.throw(() => new FileFeatureFlagSource({
      filePath: " ",
      format: ConfigurationFormat.Json
    }), ArgumentNullError);
  });

  it("Rejects the kvset profile at construction", () => {
    assert.throw(() => new FileFeatureFlagSource({
      filePath: path.join("__dirname", "../tests/sources/ffset.json"),
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet
    }), ArgumentError);
  });
});
