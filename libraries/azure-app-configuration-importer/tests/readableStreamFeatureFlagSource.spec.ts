// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert } from "chai";
import { ReadableStreamFeatureFlagSource } from "../src/settingsImport/featureFlag/readableStreamFeatureFlagSource";
import { ConfigurationFormat, ConfigurationProfile } from "../src/enums";
import { ArgumentError } from "../src/errors";

function streamFrom(data: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    }
  });
}

describe("Readable stream feature flag source tests", () => {
  it("reads enhanced feature flags from an ffset stream and exposes wildcard filters", async () => {
    const data = JSON.stringify({
      profile: "appconfig/ffset",
      items: [
        { name: "Checkout", label: "Production", enabled: true, conditions: { filters: [] } },
        { name: "DarkMode", enabled: false }
      ]
    });
    const source = new ReadableStreamFeatureFlagSource({
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.FfSet,
      data: streamFrom(data)
    });

    const featureFlags = await source.GetFeatureFlags();

    assert.deepEqual(featureFlags, [
      { name: "Checkout", label: "Production", enabled: true, conditions: { filters: [] } },
      { name: "DarkMode", enabled: false }
    ]);
    assert.deepEqual(source.FeatureFlagFilterOptions, { nameFilter: "*", labelFilter: "*" });
  });

  it("reads enhanced feature flags from a Default MS FM stream with prefix and label", async () => {
    const data = JSON.stringify({
      feature_management: {
        feature_flags: [
          { id: "Checkout", enabled: true, conditions: { client_filters: [] } }
        ]
      }
    });
    const source = new ReadableStreamFeatureFlagSource({
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.Default,
      prefix: "app:",
      label: "Production",
      data: streamFrom(data)
    });

    const featureFlags = await source.GetFeatureFlags();

    assert.equal(featureFlags.length, 1);
    assert.equal(featureFlags[0].name, "app:Checkout");
    assert.equal(featureFlags[0].label, "Production");
    assert.equal(featureFlags[0].enabled, true);
    assert.deepEqual(source.FeatureFlagFilterOptions, { nameFilter: "app:*", labelFilter: "Production" });
  });

  it("skips configuration settings and returns only feature flags for Default content", async () => {
    const data = JSON.stringify({
      ordinaryKey: "ignored",
      feature_management: {
        feature_flags: [{ id: "Beta", enabled: true }]
      }
    });
    const source = new ReadableStreamFeatureFlagSource({
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.Default,
      data: streamFrom(data)
    });

    const featureFlags = await source.GetFeatureFlags();

    assert.deepEqual(featureFlags, [{ name: "Beta", enabled: true }]);
  });

  it("returns an empty collection when Default content has no feature management", async () => {
    const source = new ReadableStreamFeatureFlagSource({
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.Default,
      data: streamFrom(JSON.stringify({ ordinaryKey: "value" }))
    });

    const featureFlags = await source.GetFeatureFlags();

    assert.deepEqual(featureFlags, []);
  });

  it("rejects the kvset profile at construction", () => {
    assert.throw(() => new ReadableStreamFeatureFlagSource({
      format: ConfigurationFormat.Json,
      profile: ConfigurationProfile.KvSet,
      data: streamFrom("{}")
    }), ArgumentError);
  });
});
