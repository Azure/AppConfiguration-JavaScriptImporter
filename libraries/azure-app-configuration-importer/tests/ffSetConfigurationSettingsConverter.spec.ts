// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert } from "chai";
import { ArgumentError } from "../src/errors";
import { FfSetConfigurationSettingsConverter } from "../src/internal/parsers/ffSetConfigurationSettingsConverter";

describe("Parse ffset format", () => {
  const converter = new FfSetConfigurationSettingsConverter();

  it("parses minimal and full enhanced feature flags", () => {
    const featureFlags = converter.Convert({
      items: [
        { name: "Minimal", enabled: false },
        {
          name: "Checkout",
          label: "Production",
          enabled: true,
          description: "Enables the new checkout flow",
          conditions: {
            requirementType: "All",
            filters: [{ name: "Microsoft.TimeWindow", parameters: { Start: "2026-08-24" } }]
          },
          variants: [{ name: "Blue", value: "blue", contentType: "text/plain", statusOverride: "Enabled" }],
          allocation: {
            defaultWhenEnabled: "Blue",
            defaultWhenDisabled: "Control",
            percentile: [{ variant: "Blue", from: 0, to: 50 }],
            user: [{ variant: "Blue", users: ["alice"] }],
            group: [{ variant: "Blue", groups: ["commerce"] }],
            seed: "checkout"
          },
          telemetry: { enabled: true, metadata: { owner: "commerce" } },
          tags: { owner: "commerce" }
        }
      ]
    });

    assert.equal(featureFlags.length, 2);
    assert.deepEqual(featureFlags[0], { name: "Minimal", enabled: false });
    assert.equal(featureFlags[1].name, "Checkout");
    assert.equal(featureFlags[1].conditions?.filters?.[0].name, "Microsoft.TimeWindow");
    assert.equal(featureFlags[1].variants?.[0].value, "blue");
    assert.equal(featureFlags[1].allocation?.percentile?.[0].to, 50);
    assert.deepEqual(featureFlags[1].tags, { owner: "commerce" });
  });

  it("parses an empty items collection", () => {
    assert.deepEqual(converter.Convert({ items: [] }), []);
  });

  it("rejects a document without an items array", () => {
    assert.throws(() => converter.Convert({}), ArgumentError);
    assert.throws(() => converter.Convert({ items: {} }), ArgumentError);
  });

  it("rejects missing or invalid required properties", () => {
    assert.throws(() => converter.Convert({ items: [{ enabled: true }] }), ArgumentError);
    assert.throws(() => converter.Convert({ items: [{ name: "", enabled: true }] }), ArgumentError);
    assert.throws(() => converter.Convert({ items: [{ name: "Checkout", enabled: "true" }] }), ArgumentError);
  });

  it("rejects classic key-values and mixed content", () => {
    assert.throws(() => converter.Convert({
      items: [{ key: "ordinary", value: "value" }]
    }), ArgumentError);
    assert.throws(() => converter.Convert({
      items: [
        { name: "Checkout", enabled: true },
        { key: "ordinary", value: "value" }
      ]
    }), ArgumentError);
  });

  it("rejects unknown and service-managed properties", () => {
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, unknown: true }]
    }), ArgumentError);
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, lastModified: "2026-08-24T00:00:00Z" }]
    }), ArgumentError);
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, _response: {} }]
    }), ArgumentError);
  });

  it("rejects invalid labels, descriptions, and tags", () => {
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, label: 1 }]
    }), ArgumentError);
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, description: false }]
    }), ArgumentError);
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, tags: { owner: 1 } }]
    }), ArgumentError);
  });

  it("rejects malformed nested feature flag fields", () => {
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, conditions: { filters: [{ parameters: {} }] } }]
    }), ArgumentError);
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, variants: [{ name: "Blue", value: 1 }] }]
    }), ArgumentError);
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, allocation: { percentile: [{ variant: "Blue", from: "0", to: 50 }] } }]
    }), ArgumentError);
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, telemetry: { enabled: "true" } }]
    }), ArgumentError);
  });
});