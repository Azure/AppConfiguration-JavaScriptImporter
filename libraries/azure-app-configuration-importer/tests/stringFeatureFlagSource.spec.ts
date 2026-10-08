// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert } from "chai";
import { ConfigurationFormat } from "../src/enums";
import { StringFeatureFlagSource } from "../src/settingsImport/featureFlag/stringFeatureFlagSource";

describe("String feature flag source test", () => {
  it("Gets enhanced feature flags from an ffset document", async () => {
    const source = new StringFeatureFlagSource({
      data: JSON.stringify({
        profile: "appconfig/ffset",
        items: [{
          name: "Checkout",
          label: "Production",
          enabled: true,
          conditions: { filters: [] },
          tags: { owner: "commerce" }
        }]
      }),
      format: ConfigurationFormat.Json
    });

    const featureFlags = await source.GetFeatureFlags();

    assert.deepEqual(featureFlags, [{
      name: "Checkout",
      label: "Production",
      enabled: true,
      conditions: { filters: [] },
      tags: { owner: "commerce" }
    }]);
  });

  it("Gets only enhanced feature flags from marker-free Default content", async () => {
    const source = new StringFeatureFlagSource({
      data: JSON.stringify({
        ordinaryKey: "ignored",
        feature_management: {
          feature_flags: [{
            id: "Checkout",
            enabled: true,
            description: "Checkout experience",
            conditions: {
              requirement_type: "All",
              client_filters: [{
                name: "Microsoft.TimeWindow",
                parameters: { Start: "Wed, 01 May 2019 13:59:59 GMT" }
              }]
            },
            variants: [{
              name: "Blue",
              configuration_value: { color: "blue" },
              status_override: "Enabled"
            }],
            allocation: {
              default_when_enabled: "Blue",
              percentile: [{ variant: "Blue", from: 0, to: 100 }]
            },
            telemetry: {
              enabled: true,
              metadata: { owner: "commerce" }
            }
          }]
        }
      }),
      format: ConfigurationFormat.Json,
      prefix: "Test:",
      label: "Production",
      tags: { environment: "production" }
    });

    const featureFlags = await source.GetFeatureFlags();

    assert.deepEqual(featureFlags, [{
      name: "Test:Checkout",
      label: "Production",
      enabled: true,
      description: "Checkout experience",
      conditions: {
        requirementType: "All",
        filters: [{
          name: "Microsoft.TimeWindow",
          parameters: { Start: "Wed, 01 May 2019 13:59:59 GMT" }
        }]
      },
      variants: [{
        name: "Blue",
        value: "{\"color\":\"blue\"}",
        contentType: "application/json",
        statusOverride: "Enabled"
      }],
      allocation: {
        percentile: [{ variant: "Blue", from: 0, to: 100 }],
        defaultWhenEnabled: "Blue"
      },
      telemetry: {
        enabled: true,
        metadata: { owner: "commerce" }
      },
      tags: { environment: "production" }
    }]);
  });
});
