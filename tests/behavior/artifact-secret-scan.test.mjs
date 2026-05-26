import assert from "node:assert/strict";
import test from "node:test";

import {
  assertArtifactTextHasNoSecrets,
  scanArtifactTextForSecrets
} from "../../.tmp/build/src/core/security/index.js";

test("artifact secret scan blocks raw secret-looking assignments", () => {
  const scan = scanArtifactTextForSecrets("allowed text\nSECRET=value\n");

  assert.equal(scan.ok, false);
  assert.deepEqual(scan.findings.map((finding) => finding.kind), ["env_secret_assignment"]);
  assert.throws(
    () => assertArtifactTextHasNoSecrets("TOKEN=abc123", "fixture"),
    /artifact secret scan blocked fixture: env_secret_assignment/
  );
});

test("artifact secret scan allows hashes and labels without raw values", () => {
  assert.doesNotThrow(() =>
    assertArtifactTextHasNoSecrets("Warnings: repository_artifact_uses_lightweight_index\nhash: abc123", "fixture")
  );
});
