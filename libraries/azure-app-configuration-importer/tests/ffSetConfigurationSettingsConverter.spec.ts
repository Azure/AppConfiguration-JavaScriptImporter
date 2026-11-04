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
            requirement_type: "All",
            filters: [{ name: "Microsoft.TimeWindow", parameters: { Start: "2026-08-24" } }]
          },
          variants: [{ name: "Blue", value: "blue", status_override: "Enabled" }],
          allocation: {
            default_when_enabled: "Blue",
            default_when_disabled: "Control",
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

    assert.deepEqual(featureFlags, [
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
        variants: [{ name: "Blue", value: "blue", statusOverride: "Enabled" }],
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
    ]);
  });

  it("preserves missing and empty conditions and filter parameters", () => {
    const featureFlags = converter.Convert({
      items: [
        { name: "MissingConditions", enabled: false },
        { name: "EmptyConditions", enabled: true, conditions: {} },
        { name: "EmptyFilters", enabled: true, conditions: { filters: [] } },
        {
          name: "OptionalParameters",
          enabled: true,
          conditions: {
            filters: [
              { name: "WithoutParameters" },
              { name: "EmptyParameters", parameters: {} }
            ]
          }
        }
      ]
    });

    assert.deepEqual(featureFlags, [
      { name: "MissingConditions", enabled: false },
      { name: "EmptyConditions", enabled: true, conditions: {} },
      { name: "EmptyFilters", enabled: true, conditions: { filters: [] } },
      {
        name: "OptionalParameters",
        enabled: true,
        conditions: {
          filters: [
            { name: "WithoutParameters" },
            { name: "EmptyParameters", parameters: {} }
          ]
        }
      }
    ]);
  });

  it("preserves encoded, numeric-looking, boolean-looking and empty parameter strings", () => {
    const featureFlags = converter.Convert({
      items: [{
        name: "StringParameters",
        enabled: true,
        conditions: {
          filters: [{
            name: "Custom",
            parameters: {
              Audience: "{\"Users\":[\"alice\"],\"DefaultRolloutPercentage\":40}",
              Value: "25",
              Boolean: "true",
              Empty: ""
            }
          }]
        }
      }]
    });

    assert.deepEqual(featureFlags[0].conditions?.filters?.[0].parameters, {
      Audience: "{\"Users\":[\"alice\"],\"DefaultRolloutPercentage\":40}",
      Value: "25",
      Boolean: "true",
      Empty: ""
    });
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
      items: [{ name: "Checkout", enabled: true, variants: [{ name: "Blue", status_override: 1 }] }]
    }), ArgumentError);
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, allocation: { percentile: [{ variant: "Blue", from: "0", to: 50 }] } }]
    }), ArgumentError);
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, telemetry: { enabled: "true" } }]
    }), ArgumentError);
  });

  it("rejects filter parameters whose values are not strings", () => {
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, conditions: { filters: [{ name: "Microsoft.Percentage", parameters: { Value: 50 } }] } }]
    }), ArgumentError, "Feature flag 'Checkout' has invalid 'parameters'.");
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, conditions: { filters: [{ name: "Microsoft.Targeting", parameters: { Audience: { DefaultRolloutPercentage: "50" } } }] } }]
    }), ArgumentError, "Feature flag 'Checkout' has invalid 'parameters'.");
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, conditions: { filters: [{ name: "Microsoft.Percentage", parameters: ["50"] }] } }]
    }), ArgumentError, "Feature flag 'Checkout' has invalid 'parameters'.");
  });

  it("rejects variant values and content types that are not strings", () => {
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, variants: [{ name: "Blue", value: { color: "blue" } }] }]
    }), ArgumentError, "Feature flag 'Checkout' has an invalid 'value'.");
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, variants: [{ name: "Blue", value: 1 }] }]
    }), ArgumentError, "Feature flag 'Checkout' has an invalid 'value'.");
    assert.throws(() => converter.Convert({
      items: [{ name: "Checkout", enabled: true, variants: [{ name: "Blue", value: "blue", content_type: 1 }] }]
    }), ArgumentError, "Feature flag 'Checkout' has an invalid 'content_type'.");
  });

  it("passes through variant string values and content types without transformation", () => {
    const featureFlags = converter.Convert({
      items: [{
        name: "Checkout",
        enabled: true,
        variants: [
          { name: "Json", value: "{\"color\":\"blue\"}", content_type: "application/json" },
          { name: "Plain", value: "blue" }
        ]
      }]
    });

    assert.deepEqual(featureFlags[0].variants, [
      { name: "Json", value: "{\"color\":\"blue\"}", contentType: "application/json" },
      { name: "Plain", value: "blue" }
    ]);
  });
});