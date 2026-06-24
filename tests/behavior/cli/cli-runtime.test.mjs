import assert from "node:assert/strict";
import test from "node:test";

import {
  checkCliNodeRuntime,
  commandRequiresSupportedNodeRuntime
} from "../../../.tmp/build/src/cli/runtime-guard.js";
import {
  describeNodeRuntimeRequirement,
  isNodeVersionAtLeast
} from "../../../.tmp/build/src/shared/index.js";

test("node runtime requirement accepts supported Node versions", () => {
  assert.equal(isNodeVersionAtLeast("22.13.0", "22.13.0"), true);
  assert.equal(isNodeVersionAtLeast("22.21.1", "22.13.0"), true);
  assert.equal(isNodeVersionAtLeast("23.6.1", "22.13.0"), true);
  assert.equal(describeNodeRuntimeRequirement("23.6.1").supported, true);
});

test("node runtime requirement rejects older and malformed versions", () => {
  assert.equal(isNodeVersionAtLeast("22.12.0", "22.13.0"), false);
  assert.equal(isNodeVersionAtLeast("22.4.0", "22.13.0"), false);
  assert.equal(isNodeVersionAtLeast("20.19.0", "22.13.0"), false);
  assert.equal(isNodeVersionAtLeast("not-a-version", "22.13.0"), false);
});

test("cli runtime guard keeps static help and mcp guidance available on old Node", () => {
  assert.equal(commandRequiresSupportedNodeRuntime("help", new Set()), false);
  assert.equal(commandRequiresSupportedNodeRuntime("init", new Set(["--help"])), false);
  assert.equal(commandRequiresSupportedNodeRuntime("mcp", new Set()), false);
  assert.equal(commandRequiresSupportedNodeRuntime("mcp", new Set(["--print-config"])), false);
  assert.equal(checkCliNodeRuntime("help", new Set(), "20.19.0"), undefined);
});

test("cli runtime guard blocks storage-backed commands on old Node", () => {
  const failure = checkCliNodeRuntime("compile", new Set(), "22.4.0");
  assert.equal(failure?.runtime.supported, false);
  assert.equal(failure?.runtime.minimumVersion, "22.13.0");
  assert.match(failure?.message ?? "", /below Grape's required >=22\.13\.0 runtime/);
  assert.ok(failure?.recoveryGuidance.some((line) => line.includes("Node.js 22.13.0 or newer")));

  assert.equal(checkCliNodeRuntime("mcp", new Set(["--stdio"]), "22.4.0")?.runtime.supported, false);
  assert.equal(checkCliNodeRuntime("export", new Set(), "22.4.0")?.runtime.supported, false);
  assert.equal(checkCliNodeRuntime("status", new Set(), "23.6.1"), undefined);
});
