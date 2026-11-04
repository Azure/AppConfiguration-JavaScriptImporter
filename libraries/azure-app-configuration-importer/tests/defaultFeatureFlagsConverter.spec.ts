// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert } from "chai";
import { ArgumentError } from "../src/errors";
import { ConfigurationFormat } from "../src/enums";
import { SourceOptions } from "../src/options";
import { ClientFilter } from "../src/models";
import { DefaultFeatureFlagsConverter } from "../src/internal/parsers/defaultFeatureFlagsConverter";

describe("DefaultFeatureFlagsConverter feature flags", () => {
  const converter = new DefaultFeatureFlagsConverter();

  function convert(featureFlags: Array<Record<string, unknown>>, options?: Partial<SourceOptions>) {
    return converter.Convert(
      { feature_management: { feature_flags: featureFlags } },
      { format: ConfigurationFormat.Json, ...options }
    );
  }

  it("converts a minimal MS FM feature flag", () => {
    assert.deepEqual(convert([{ id: "Checkout", enabled: true }]), [{ name: "Checkout", enabled: true }]);
  });

  const filterSchemas = [
    {
      name: "Microsoft feature_management",
      createConfig: (filters: ClientFilter[]) => ({
        feature_management: {
          feature_flags: [{
            id: "ImportTest",
            enabled: false,
            conditions: { requirement_type: "Any", client_filters: filters }
          }]
        }
      })
    },
    {
      name: ".NET FeatureManagement",
      createConfig: (filters: ClientFilter[]) => ({
        FeatureManagement: {
          ImportTest: {
            RequirementType: "Any",
            EnabledFor: filters.map(filter => ({
              Name: filter.name,
              ...(filter.parameters !== undefined ? { Parameters: filter.parameters } : {})
            }))
          }
        }
      })
    }
  ];

  for (const schema of filterSchemas) {
    describe(`DefaultFeatureFlagsConverter ${schema.name} enhanced filter parameters`, () => {
      const converter = new DefaultFeatureFlagsConverter();
      const options = { format: ConfigurationFormat.Json };

      it("JSON-encodes nested targeting and numeric percentage parameters without mutating the input", () => {
        const filters = [
          {
            name: "Microsoft.Targeting",
            parameters: { Audience: { Users: ["userA"], Groups: [], DefaultRolloutPercentage: 40 } }
          },
          { name: "Microsoft.Percentage", parameters: { Value: 25 } }
        ];
        const config = schema.createConfig(filters);
        const originalConfig = JSON.parse(JSON.stringify(config));

        const result = converter.Convert(config, options);

        assert.deepEqual(result[0].conditions, {
          requirementType: "Any",
          filters: [
            {
              name: "Microsoft.Targeting",
              parameters: { Audience: "{\"Users\":[\"userA\"],\"Groups\":[],\"DefaultRolloutPercentage\":40}" }
            },
            { name: "Microsoft.Percentage", parameters: { Value: "25" } }
          ]
        });
        assert.deepEqual(config, originalConfig);
        assert.notStrictEqual<unknown>(result[0].conditions?.filters?.[0], filters[0]);
        assert.notStrictEqual<unknown>(result[0].conditions?.filters?.[0].parameters, filters[0].parameters);
      });

      it("preserves strings and JSON-encodes other supported parameter values", () => {
        const result = converter.Convert(schema.createConfig([{
          name: "Custom",
          parameters: {
            Text: "unchanged",
            JsonText: "{\"Value\":25}",
            EmptyText: "",
            Enabled: true,
            Disabled: false,
            Zero: 0,
            Fraction: 0.25,
            Null: null,
            Array: ["userA", 25, false, null, { nested: true }],
            EmptyObject: {},
            EmptyArray: []
          }
        }]), options);

        assert.deepEqual(result[0].conditions?.filters?.[0].parameters, {
          Text: "unchanged",
          JsonText: "{\"Value\":25}",
          EmptyText: "",
          Enabled: "true",
          Disabled: "false",
          Zero: "0",
          Fraction: "0.25",
          Null: "null",
          Array: "[\"userA\",25,false,null,{\"nested\":true}]",
          EmptyObject: "{}",
          EmptyArray: "[]"
        });
      });

      it("supports filters with missing or empty parameters", () => {
        const result = converter.Convert(schema.createConfig([
          { name: "WithoutParameters" },
          { name: "EmptyParameters", parameters: {} }
        ]), options);

        assert.deepEqual(result[0].conditions?.filters, [
          { name: "WithoutParameters" },
          { name: "EmptyParameters", parameters: {} }
        ]);
      });
    });
  }

  it("transforms the snake_case fields of a full MS FM feature flag into FeatureFlagParam", () => {
    const msFm = {
      id: "Checkout",
      enabled: true,
      description: "Enables the new checkout flow",
      conditions: {
        requirement_type: "All",
        client_filters: [{ name: "Microsoft.TimeWindow", parameters: { Start: "2026-08-24" } }]
      },
      variants: [{ name: "Blue", configuration_value: "blue", status_override: "Enabled" }],
      allocation: {
        default_when_enabled: "Blue",
        percentile: [{ variant: "Blue", from: 0, to: 50 }],
        user: [{ variant: "Blue", users: ["alice"] }],
        group: [{ variant: "Blue", groups: ["commerce"] }],
        seed: "checkout"
      },
      telemetry: { enabled: true, metadata: { owner: "commerce" } }
    };

    assert.deepEqual(convert([msFm], { label: "Production", tags: { owner: "commerce" } }), [{
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

  it("serializes a non-string variant configuration_value as JSON", () => {
    const result = convert([{
      id: "Checkout",
      enabled: true,
      variants: [{ name: "Blue", configuration_value: { color: "blue" } }]
    }]);

    assert.equal(result[0].variants?.[0].value, "{\"color\":\"blue\"}");
    assert.equal(result[0].variants?.[0].contentType, "application/json");
  });

  it("accepts object-valued filter parameters such as Microsoft.Targeting", () => {
    const result = convert([{
      id: "Beta",
      enabled: true,
      conditions: { client_filters: [{ name: "Microsoft.Targeting", parameters: { Audience: { DefaultRolloutPercentage: 50 } } }] }
    }]);

    assert.equal(result[0].conditions?.filters?.[0].name, "Microsoft.Targeting");
  });

  it("converts multiple MS FM entries in the same array", () => {
    const result = convert([
      { id: "First", enabled: true, conditions: { client_filters: [] } },
      { id: "Second", enabled: true, conditions: { client_filters: [] } }
    ]);

    assert.equal(result.length, 2);
    assert.equal(result[0].name, "First");
    assert.equal(result[1].name, "Second");
  });

  it("applies the prefix to the resolved name", () => {
    assert.equal(convert([{ id: "Checkout", enabled: true }], { prefix: "app:" })[0].name, "app:Checkout");
  });

  it("applies label and tags from source options", () => {
    const result = convert([{ id: "Checkout", enabled: true }], { label: "Production", tags: { owner: "platform" } });
    assert.equal(result[0].label, "Production");
    assert.deepEqual(result[0].tags, { owner: "platform" });
  });

  it("keeps the last feature flag when resolved names collide", () => {
    const result = convert([
      { id: "Checkout", enabled: true, description: "first" },
      { id: "Checkout", enabled: false, description: "second" }
    ]);

    assert.equal(result.length, 1);
    assert.isFalse(result[0].enabled);
    assert.equal(result[0].description, "second");
  });

  it("uses the id and ignores a stray name when both are present", () => {
    const result = convert([{ id: "Legacy", name: "Ignored", enabled: true }]);

    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Legacy");
  });

  it("rejects a name-based (enhanced) entry in the default profile", () => {
    assert.throws(() => convert([{ name: "Checkout", enabled: true, conditions: { filters: [] } }]), ArgumentError);
  });

  it("rejects an entry without an id", () => {
    assert.throws(() => convert([{ enabled: true }]), ArgumentError);
  });

  it("rejects a flag with a non-boolean enabled", () => {
    assert.throws(() => convert([{ id: "Checkout", enabled: "true" }]), ArgumentError);
  });

  it("rejects a flag with an invalid id", () => {
    assert.throws(() => convert([{ id: "Check:out", enabled: true }]), ArgumentError);
  });

  it("converts a Microsoft Feature Management feature flag with client filters", () => {
    const result = convert([{
      id: "Legacy",
      enabled: true,
      conditions: { client_filters: [{ name: "Microsoft.TimeWindow", parameters: {} }] }
    }]);

    assert.equal(result[0].name, "Legacy");
    assert.equal(result[0].conditions?.filters?.[0].name, "Microsoft.TimeWindow");
  });
});
