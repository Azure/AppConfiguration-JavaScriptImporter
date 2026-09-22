// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert, expect } from "chai";
import { FeatureFlag, FeatureFlagClient } from "@azure/app-configuration";
import * as sinon from "sinon";
import { ChangeType, ConfigurationFormat, ImportMode } from "../src/enums";
import { ArgumentError, OperationTimeoutError } from "../src/errors";
import { FeatureFlagImporter } from "../src/featureFlagImporter";
import { FeatureFlagChange, ImportProgress } from "../src/models";
import { FeatureFlagChangesSource } from "../src/settingsImport/featureFlag/featureFlagChangesSource";
import { IterableFeatureFlagSource } from "../src/settingsImport/featureFlag/iterableFeatureFlagSource";
import { StringFeatureFlagSource } from "../src/settingsImport/featureFlag/stringFeatureFlagSource";
import { IterableFeatureFlagSourceOptions } from "../src/options";

describe("FeatureFlagImporter", () => {
  it("succeeds importing a simple FFSet file", async () => {
    const client = createClient();
    const importer = new FeatureFlagImporter(client.client);
    let progress: ImportProgress | undefined;

    await importer.Import(createFfSetSource([
      { name: "Checkout", enabled: true },
      { name: "Search", enabled: false }
    ]), {
      timeout: 3,
      progressCallback: value => progress = value
    });

    assert.equal(client.addFeatureFlag.callCount, 0);
    assert.equal(client.setFeatureFlag.callCount, 2);
    assert.deepEqual(progress, { successCount: 2, importCount: 2 });
  });

  it("fails import when the server returns an error", async () => {
    const client = createClient();
    client.setFeatureFlag.rejects(new Error("server error"));
    const importer = new FeatureFlagImporter(client.client);

    const error = await captureError(() => importer.Import(
      createFfSetSource([{ name: "Checkout", enabled: true }]),
      { timeout: 1 }
    ));

    assert.equal(error.message, "server error");
  });

  it("fails import when the timeout is exceeded", async () => {
    const client = createClient();
    client.setFeatureFlag.callsFake(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { name: "Checkout", enabled: true };
    });
    const importer = new FeatureFlagImporter(client.client);

    const error = await captureError(() => importer.Import(
      createFfSetSource([{ name: "Checkout", enabled: true }]),
      { timeout: 0.01 }
    ));

    assert.instanceOf(error, OperationTimeoutError);
  });

  it("succeeds after surviving client throttling", async () => {
    const client = createClient();
    const throttledError = Object.assign(new Error("client throttled"), { statusCode: 429 });
    client.setFeatureFlag.onFirstCall().rejects(throttledError);
    client.setFeatureFlag.resolves({ name: "Checkout", enabled: true });
    const importer = new FeatureFlagImporter(client.client);

    await importer.Import(createFfSetSource([{ name: "Checkout", enabled: true }]), { timeout: 3 });

    assert.equal(client.setFeatureFlag.callCount, 2);
  });

  it("imports an empty FFSet file without error", async () => {
    const client = createClient();
    const importer = new FeatureFlagImporter(client.client);

    await importer.Import(createFfSetSource([]), { timeout: 3 });

    assert.equal(client.addFeatureFlag.callCount, 0);
    assert.equal(client.setFeatureFlag.callCount, 0);
    assert.equal(client.deleteFeatureFlag.callCount, 0);
  });

  it("transforms feature flags from an iterator and exposes its filters", async () => {
    const source = new IterableFeatureFlagSource({
      data: featureFlagIterator([
        { name: "app:Checkout", label: "Development", enabled: true }
      ]) as unknown as IterableFeatureFlagSourceOptions["data"],
      prefix: "Test:",
      trimPrefix: "app:",
      label: "Production"
    });

    const featureFlags = await source.GetFeatureFlags();

    assert.deepEqual(featureFlags, [
      { name: "Test:Checkout", label: "Production", enabled: true }
    ]);
    assert.deepEqual(source.FeatureFlagFilterOptions, {
      nameFilter: "Test:*",
      labelFilter: "Production"
    });
  });

  it("deletes unmatched feature flags in strict mode", async () => {
    const client = createClient([
      { name: "Keep", enabled: true },
      { name: "Delete", enabled: true }
    ]);
    const importer = new FeatureFlagImporter(client.client);

    await importer.Import(createFfSetSource([{ name: "Keep", enabled: true }]), {
      timeout: 3,
      strict: true
    });

    assert.equal(client.deleteFeatureFlag.callCount, 1);
    assert.equal(client.deleteFeatureFlag.firstCall.args[0].name, "Delete");
  });

  it("imports pre-calculated feature flag changes", async () => {
    const client = createClient();
    const importer = new FeatureFlagImporter(client.client);
    const changes: FeatureFlagChange[] = [
      { changeType: ChangeType.Create, currentValue: null, newValue: { name: "Create", enabled: true } },
      { changeType: ChangeType.Update, currentValue: { name: "Update", enabled: false }, newValue: { name: "Update", enabled: true } },
      { changeType: ChangeType.None, currentValue: { name: "Keep", enabled: true }, newValue: { name: "Keep", enabled: true } },
      { changeType: ChangeType.Delete, currentValue: { name: "Delete", enabled: true }, newValue: null }
    ];
    let progress: ImportProgress | undefined;

    await importer.Import(new FeatureFlagChangesSource(changes), {
      timeout: 3,
      progressCallback: value => progress = value
    });

    assert.equal(client.addFeatureFlag.callCount, 0);
    assert.equal(client.setFeatureFlag.callCount, 3);
    assert.equal(client.deleteFeatureFlag.callCount, 1);
    assert.deepEqual(progress, { successCount: 3, importCount: 3 });
    assert.equal(client.listFeatureFlags.callCount, 0);
  });

  it("rejects filter options for pre-calculated feature flag changes", () => {
    expect(() => new FeatureFlagChangesSource([], { nameFilter: "*" }))
      .to.throw(ArgumentError, "FeatureFlagFilterOptions are not supported for FeatureFlagChangesSource.");
  });

  it("rejects strict and importMode for pre-calculated changes", async () => {
    const client = createClient();
    const importer = new FeatureFlagImporter(client.client);
    const changes = new FeatureFlagChangesSource([
      { changeType: ChangeType.Create, currentValue: null, newValue: { name: "Create", enabled: true } }
    ]);

    const error = await captureError(() => importer.Import(changes, {
      timeout: 3,
      strict: true,
      importMode: ImportMode.All
    }));

    assert.instanceOf(error, ArgumentError);
    expect(error.message).to.contain("not applicable when importing pre-calculated changes");
  });

  describe("GetFeatureFlagChanges", () => {
    const existing: FeatureFlag[] = [
      { name: "Update", enabled: false },
      { name: "Keep", enabled: true },
      { name: "Delete", enabled: true }
    ];

    it("returns creates, updates, and matches for Default with importMode All", async () => {
      const client = createClient(existing);
      const importer = new FeatureFlagImporter(client.client);

      const changes = await importer.GetFeatureFlagChanges(createDefaultSource([
        { id: "Create", enabled: true },
        { id: "Update", enabled: true },
        { id: "Keep", enabled: true }
      ]), false, ImportMode.All);

      assertChangeCounts(changes, 1, 1, 1, 0);
    });

    it("omits matches for Default with importMode IgnoreMatch", async () => {
      const client = createClient(existing);
      const importer = new FeatureFlagImporter(client.client);

      const changes = await importer.GetFeatureFlagChanges(createDefaultSource([
        { id: "Create", enabled: true },
        { id: "Update", enabled: true },
        { id: "Keep", enabled: true }
      ]), false, ImportMode.IgnoreMatch);

      assertChangeCounts(changes, 1, 1, 0, 0);
    });

    it("returns creates, updates, and matches for FFSet with importMode All", async () => {
      const client = createClient(existing);
      const importer = new FeatureFlagImporter(client.client);

      const changes = await importer.GetFeatureFlagChanges(createFfSetSource([
        { name: "Create", enabled: true },
        { name: "Update", enabled: true },
        { name: "Keep", enabled: true }
      ]), false, ImportMode.All);

      assert.equal(changes.filter(change => change.changeType === ChangeType.Create).length, 1);
      assert.equal(changes.filter(change => change.changeType === ChangeType.Update).length, 1);
      assert.equal(changes.filter(change => change.changeType === ChangeType.None).length, 1);
      assert.equal(changes.filter(change => change.changeType === ChangeType.Delete).length, 0);
    });

    it("omits matches for FFSet with importMode IgnoreMatch", async () => {
      const client = createClient(existing);
      const importer = new FeatureFlagImporter(client.client);

      const changes = await importer.GetFeatureFlagChanges(createFfSetSource([
        { name: "Create", enabled: true },
        { name: "Update", enabled: true },
        { name: "Keep", enabled: true }
      ]), false, ImportMode.IgnoreMatch);

      assert.equal(changes.filter(change => change.changeType === ChangeType.Create).length, 1);
      assert.equal(changes.filter(change => change.changeType === ChangeType.Update).length, 1);
      assert.equal(changes.filter(change => change.changeType === ChangeType.None).length, 0);
      assert.equal(changes.filter(change => change.changeType === ChangeType.Delete).length, 0);
    });

    it("returns strict deletions using name and label identity", async () => {
      const client = createClient([
        { name: "Checkout", label: "Production", enabled: true },
        { name: "Checkout", label: "Development", enabled: true }
      ]);
      const importer = new FeatureFlagImporter(client.client);

      const changes = await importer.GetFeatureFlagChanges(createFfSetSource([
        { name: "Checkout", label: "Production", enabled: true }
      ]), true, ImportMode.All);

      const deletions = changes.filter(change => change.changeType === ChangeType.Delete);
      assert.equal(deletions.length, 1);
      assert.equal(deletions[0].currentValue?.label, "Development");
    });

    it("rejects an invalid import mode", async () => {
      const client = createClient();
      const importer = new FeatureFlagImporter(client.client);

      const error = await captureError(() => importer.GetFeatureFlagChanges(
        createFfSetSource([]),
        false,
        9 as unknown as ImportMode
      ));

      assert.instanceOf(error, ArgumentError);
      assert.equal(error.message, "Only options supported for Import Mode are 'All' and 'Ignore-Match'.");
    });

    it("uses one correlation request ID for list and write operations", async () => {
      const client = createClient();
      const importer = new FeatureFlagImporter(client.client);

      await importer.Import(createFfSetSource([{ name: "Checkout", enabled: true }]), { timeout: 3 });

      const listHeaders = client.listFeatureFlags.firstCall.args[0].requestOptions.customHeaders;
      const setHeaders = client.setFeatureFlag.firstCall.args[1].requestOptions.customHeaders;
      assert.equal(setHeaders["x-ms-correlation-request-id"], listHeaders["x-ms-correlation-request-id"]);
    });
  });
});

function createFfSetSource(items: Array<Record<string, unknown>>): StringFeatureFlagSource {
  return new StringFeatureFlagSource({
    data: JSON.stringify({ profile: "appconfig/ffset", items }),
    format: ConfigurationFormat.Json
  });
}

function createDefaultSource(featureFlags: Array<Record<string, unknown>>): StringFeatureFlagSource {
  return new StringFeatureFlagSource({
    data: JSON.stringify({ feature_management: { feature_flags: featureFlags } }),
    format: ConfigurationFormat.Json
  });
}

function assertChangeCounts(
  changes: FeatureFlagChange[],
  creates: number,
  updates: number,
  matches: number,
  deletes: number
): void {
  assert.equal(changes.filter(change => change.changeType === ChangeType.Create).length, creates);
  assert.equal(changes.filter(change => change.changeType === ChangeType.Update).length, updates);
  assert.equal(changes.filter(change => change.changeType === ChangeType.None).length, matches);
  assert.equal(changes.filter(change => change.changeType === ChangeType.Delete).length, deletes);
}

function createClient(existing: FeatureFlag[] = []) {
  const listFeatureFlags = sinon.stub().callsFake(() => featureFlagIterator(existing));
  const addFeatureFlag = sinon.stub().resolves({ name: "Created", enabled: true });
  const setFeatureFlag = sinon.stub().resolves({ name: "Set", enabled: true });
  const deleteFeatureFlag = sinon.stub().resolves({ statusCode: 204 });
  return {
    client: { listFeatureFlags, addFeatureFlag, setFeatureFlag, deleteFeatureFlag } as unknown as FeatureFlagClient,
    listFeatureFlags,
    addFeatureFlag,
    setFeatureFlag,
    deleteFeatureFlag
  };
}

async function captureError(action: () => Promise<unknown>): Promise<Error> {
  try {
    await action();
  }
  catch (error) {
    return error as Error;
  }
  assert.fail("Expected action to throw");
}

function featureFlagIterator(items: FeatureFlag[]): AsyncIterableIterator<FeatureFlag> {
  let index = 0;
  return {
    next: async () => index < items.length
      ? { value: items[index++], done: false }
      : { value: undefined, done: true },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}