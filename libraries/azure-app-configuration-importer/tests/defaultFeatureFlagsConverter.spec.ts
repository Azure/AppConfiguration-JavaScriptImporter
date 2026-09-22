// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert } from "chai";
import { ArgumentError } from "../src/errors";
import { ConfigurationFormat } from "../src/enums";
import { SourceOptions } from "../src/options";
import { DefaultFeatureFlagsConverter } from "../src/internal/parsers/defaultFeatureFlagsConverter";

describe("DefaultFeatureFlagsConverter enhanced feature flags", () => {
  const converter = new DefaultFeatureFlagsConverter();

  function convert(featureFlags: Array<Record<string, unknown>>, options?: Partial<SourceOptions>) {
    return converter.Convert(
      { feature_management: { feature_flags: featureFlags } },
      { format: ConfigurationFormat.Json, ...options }
    );
  }

  it("converts a minimal enhanced feature flag", () => {
    assert.deepEqual(convert([{ name: "Checkout", enabled: true }]), [{ name: "Checkout", enabled: true }]);
  });

  it("normalizes the snake_case fields of a full enhanced feature flag", () => {
    const enhanced = {
      name: "Checkout",
      label: "Production",
      enabled: true,
      description: "Enables the new checkout flow",
      conditions: {
        requirement_type: "All",
        filters: [{ name: "Microsoft.TimeWindow", parameters: { Start: "2026-08-24" } }]
      },
      variants: [{ name: "Blue", configuration_value: "blue", status_override: "Enabled" }],
      allocation: {
        default_when_enabled: "Blue",
        percentile: [{ variant: "Blue", from: 0, to: 50 }],
        user: [{ variant: "Blue", users: ["alice"] }],
        group: [{ variant: "Blue", groups: ["commerce"] }],
        seed: "checkout"
      },
      telemetry: { enabled: true, metadata: { owner: "commerce" } },
      tags: { owner: "commerce" }
    };

    assert.deepEqual(convert([enhanced]), [{
      name: "Checkout",
      enabled: true,
      description: "Enables the new checkout flow",
      label: "Production",
      conditions: {
        filters: [{ name: "Microsoft.TimeWindow", parameters: { Start: "2026-08-24" } }],
        requirementType: "All"
      },
      variants: [{ name: "Blue", value: "blue", statusOverride: "Enabled" }],
      allocation: {
        user: [{ variant: "Blue", users: ["alice"] }],
        group: [{ variant: "Blue", groups: ["commerce"] }],
        percentile: [{ variant: "Blue", from: 0, to: 50 }],
        seed: "checkout",
        defaultWhenEnabled: "Blue"
      },
      telemetry: { enabled: true, metadata: { owner: "commerce" } },
      tags: { owner: "commerce" }
    }]);
  });

  it("accepts object-valued filter parameters such as Microsoft.Targeting", () => {
    const result = convert([{
      name: "Beta",
      enabled: true,
      conditions: { filters: [{ name: "Microsoft.Targeting", parameters: { Audience: { DefaultRolloutPercentage: 50 } } }] }
    }]);

    assert.equal(result[0].conditions?.filters?.[0].name, "Microsoft.Targeting");
  });

  it("converts legacy and enhanced entries in the same array", () => {
    const result = convert([
      { id: "Legacy", enabled: true, conditions: { client_filters: [] } },
      { name: "Enhanced", enabled: true, conditions: { filters: [] } }
    ]);

    assert.equal(result.length, 2);
    assert.equal(result[0].name, "Legacy");
    assert.equal(result[1].name, "Enhanced");
  });

  it("applies the prefix to the enhanced name", () => {
    assert.equal(convert([{ name: "Checkout", enabled: true }], { prefix: "app:" })[0].name, "app:Checkout");
  });

  it("prefers embedded label and tags but lets source options override them", () => {
    const embedded = convert([{ name: "Checkout", enabled: true, label: "Embedded", tags: { owner: "team" } }]);
    assert.equal(embedded[0].label, "Embedded");
    assert.deepEqual(embedded[0].tags, { owner: "team" });

    const overridden = convert(
      [{ name: "Checkout", enabled: true, label: "Embedded", tags: { owner: "team" } }],
      { label: "Production", tags: { owner: "platform" } }
    );
    assert.equal(overridden[0].label, "Production");
    assert.deepEqual(overridden[0].tags, { owner: "platform" });
  });

  it("keeps the last feature flag when resolved names collide", () => {
    const result = convert([
      { name: "Checkout", enabled: true, description: "first" },
      { name: "Checkout", enabled: false, description: "second" }
    ]);

    assert.equal(result.length, 1);
    assert.isFalse(result[0].enabled);
    assert.equal(result[0].description, "second");
  });

  it("rejects an entry that contains both id and name", () => {
    assert.throws(() => convert([{ id: "Legacy", name: "Enhanced", enabled: true }]), ArgumentError);
  });

  it("rejects an entry without id or name", () => {
    assert.throws(() => convert([{ enabled: true }]), ArgumentError);
  });

  it("rejects an enhanced flag with a non-boolean enabled", () => {
    assert.throws(() => convert([{ name: "Checkout", enabled: "true" }]), ArgumentError);
  });

  it("rejects an enhanced flag missing enabled", () => {
    assert.throws(() => convert([{ name: "Checkout" }]), ArgumentError);
  });

  it("rejects an enhanced flag that uses conditions.client_filters", () => {
    assert.throws(() => convert([{ name: "Checkout", enabled: true, conditions: { client_filters: [] } }]), ArgumentError);
  });

  it("rejects an enhanced flag with an invalid name", () => {
    assert.throws(() => convert([{ name: "Check:out", enabled: true }]), ArgumentError);
  });

  it("still converts a legacy Microsoft Feature Management feature flag", () => {
    const result = convert([{
      id: "Legacy",
      enabled: true,
      conditions: { client_filters: [{ name: "Microsoft.TimeWindow", parameters: {} }] }
    }]);

    assert.equal(result[0].name, "Legacy");
    assert.equal(result[0].conditions?.filters?.[0].name, "Microsoft.TimeWindow");
  });
});
