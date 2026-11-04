// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { FeatureFlagAllocation, FeatureFlagParam, featureFlagContentType, featureFlagPrefix } from "@azure/app-configuration";
import { assert } from "chai";
import { readFileSync, readdirSync } from "fs";
import * as jsyaml from "js-yaml";
import * as path from "path";
import { ConfigurationFormat } from "../src/enums";
import { ArgumentError } from "../src/errors";
import { ClientFilter } from "../src/models";
import { StringConfigurationSettingsSource } from "../src/settingsImport/configurationSettings/stringConfigurationSettingsSource";
import { StringFeatureFlagSource } from "../src/settingsImport/featureFlag/stringFeatureFlagSource";
import { assertThrowAsync } from "./utlis";

type SampleFlag = {
  id: string;
  enabled?: boolean | string;
  description?: string;
  conditions?: {
    requirement_type?: string;
    client_filters?: ClientFilter[];
  };
  variants?: {
    name: string;
    configuration_value?: string;
    status_override?: string;
  }[];
  allocation?: Omit<FeatureFlagAllocation, "defaultWhenEnabled" | "defaultWhenDisabled"> & {
    default_when_enabled?: string;
    default_when_disabled?: string;
  };
  telemetry?: FeatureFlagParam["telemetry"];
};

function assertConvertedFlag(actual: FeatureFlagParam, sample: SampleFlag): void {
  assert.equal(actual.name, sample.id);
  assert.strictEqual(actual.enabled, sample.enabled ?? false);
  assert.equal(actual.description, sample.description);
  assert.equal(actual.conditions?.requirementType, sample.conditions?.requirement_type);
  assert.deepEqual(actual.telemetry, sample.telemetry);

  const filters = actual.conditions?.filters ?? [];
  const sampleFilters = sample.conditions?.client_filters ?? [];
  assert.lengthOf(filters, sampleFilters.length);
  sampleFilters.forEach((filter, index) => {
    assert.equal(filters[index].name, filter.name);
    const parameters = filters[index].parameters ?? {};
    assert.sameMembers(Object.keys(parameters), Object.keys(filter.parameters ?? {}));
    for (const [name, value] of Object.entries(filter.parameters ?? {})) {
      assert.isString(parameters[name]);
      if (typeof value === "string") {
        assert.strictEqual(parameters[name], value);
      }
      else {
        assert.deepEqual(JSON.parse(parameters[name]), value);
      }
    }
  });

  const variants = actual.variants ?? [];
  assert.lengthOf(variants, sample.variants?.length ?? 0);
  sample.variants?.forEach((variant, index) => {
    assert.equal(variants[index].name, variant.name);
    assert.strictEqual(variants[index].value, variant.configuration_value);
    assert.equal(variants[index].statusOverride, variant.status_override);
    assert.isUndefined(variants[index].contentType);
  });

  assert.deepEqual(actual.allocation?.user, sample.allocation?.user);
  assert.deepEqual(actual.allocation?.group, sample.allocation?.group);
  assert.deepEqual(actual.allocation?.percentile, sample.allocation?.percentile);
  assert.equal(actual.allocation?.seed, sample.allocation?.seed);
  assert.equal(actual.allocation?.defaultWhenEnabled, sample.allocation?.default_when_enabled);
  assert.equal(actual.allocation?.defaultWhenDisabled, sample.allocation?.default_when_disabled);
}

describe("Feature Management sample imports", () => {
  const directory = path.join(__dirname, "sources", "featureManagement", "upstreamSamples");
  const expectedRejections: Record<string, string[]> = {
    "NoFilters.sample.json": ["InvalidEnabled"]
  };

  for (const file of readdirSync(directory).filter(name => name.endsWith(".sample.json")).sort()) {
    describe(file, () => {
      const data = readFileSync(path.join(directory, file), "utf8");
      const document: { feature_management: { feature_flags: SampleFlag[] } } = JSON.parse(data);
      const rejectedIds = expectedRejections[file] ?? [];
      const sampleFlags = document.feature_management.feature_flags;
      const validFlags = sampleFlags.filter(flag => !rejectedIds.includes(flag.id));
      const validData = rejectedIds.length > 0
        ? JSON.stringify({ feature_management: { feature_flags: validFlags } })
        : data;

      for (const format of [ConfigurationFormat.Json, ConfigurationFormat.Yaml]) {
        describe(ConfigurationFormat[format], () => {
          const serialize = (input: string): string => format === ConfigurationFormat.Yaml
            ? jsyaml.dump(JSON.parse(input), { schema: jsyaml.JSON_SCHEMA })
            : input;

          for (const importer of [
            {
              name: "classic key-value",
              read: (input: string) => new StringConfigurationSettingsSource({
                data: serialize(input),
                format
              }).GetConfigurationSettings()
            },
            {
              name: "enhanced",
              read: (input: string) => new StringFeatureFlagSource({
                data: serialize(input),
                format
              }).GetFeatureFlags()
            }
          ]) {
            if (rejectedIds.length > 0) {
              it(`rejects the original invalid document on the ${importer.name} path`, async () => {
                await assertThrowAsync(() => importer.read(data), ArgumentError);
              });

              for (const id of rejectedIds) {
                it(`rejects the intentionally invalid ${id} flag on the ${importer.name} path`, async () => {
                  const flag = sampleFlags.find(flag => flag.id === id);
                  assert.exists(flag);
                  const invalidData = JSON.stringify({ feature_management: { feature_flags: [flag] } });
                  await assertThrowAsync(() => importer.read(invalidData), ArgumentError);
                });
              }
            }
          }

          it("imports valid definitions as classic key-value flags without losing their configuration", async () => {
            const source = new StringConfigurationSettingsSource({
              data: serialize(validData),
              format
            });

            const settings = await source.GetConfigurationSettings();

            assert.lengthOf(settings, validFlags.length);
            settings.forEach((setting, index) => {
              const sample = validFlags[index];
              assert.strictEqual(setting.key, featureFlagPrefix + sample.id);
              assert.strictEqual(setting.contentType, featureFlagContentType);
              assert.isString(setting.value);
              assert.deepEqual(JSON.parse(setting.value as string), {
                ...sample,
                conditions: {
                  ...sample.conditions,
                  client_filters: sample.conditions?.client_filters ?? []
                }
              });
            });

            if (format === ConfigurationFormat.Yaml) {
              const jsonSource = new StringConfigurationSettingsSource({
                data: validData,
                format: ConfigurationFormat.Json
              });
              assert.deepEqual(settings, await jsonSource.GetConfigurationSettings());
            }
          });

          it("imports valid definitions as enhanced flags without losing their configuration", async () => {
            const source = new StringFeatureFlagSource({
              data: serialize(validData),
              format
            });

            const flags = await source.GetFeatureFlags();

            assert.lengthOf(flags, validFlags.length);
            flags.forEach((flag, index) => assertConvertedFlag(flag, validFlags[index]));

            if (format === ConfigurationFormat.Yaml) {
              const jsonSource = new StringFeatureFlagSource({
                data: validData,
                format: ConfigurationFormat.Json
              });
              assert.deepEqual(flags, await jsonSource.GetFeatureFlags());
            }
          });
        });
      }
    });
  }
});
