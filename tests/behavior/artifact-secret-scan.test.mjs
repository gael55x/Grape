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

test("artifact secret scan blocks structured secret fields and common token shapes", () => {
  const scan = scanArtifactTextForSecrets(`
    {"clientSecret":"example-secret-value"}
    const openai = "sk-proj-abcdefghijklmnopqrstuvwxyz";
    postgres://user:password@example.test/db
  `);

  assert.equal(scan.ok, false);
  assert.deepEqual(
    scan.findings.map((finding) => finding.kind),
    ["secret_named_assignment", "api_secret_token", "credentialed_database_url"]
  );
});

test("artifact secret scan blocks secret-looking values on long generated lines", () => {
  const scan = scanArtifactTextForSecrets(`${"x".repeat(5000)} SECRET=value {"clientSecret":"example-secret-value"}`);

  assert.equal(scan.ok, false);
  assert.deepEqual(
    scan.findings.map((finding) => finding.kind),
    ["env_secret_assignment", "secret_named_assignment"]
  );
});

test("artifact secret scan allows hashes and labels without raw values", () => {
  assert.doesNotThrow(() =>
    assertArtifactTextHasNoSecrets("Warnings: repository_artifact_uses_lightweight_index\nhash: abc123", "fixture")
  );
  assert.doesNotThrow(() =>
    assertArtifactTextHasNoSecrets("const apiKey = process.env.OPENAI_API_KEY;\n", "fixture")
  );
  assert.doesNotThrow(() =>
    assertArtifactTextHasNoSecrets("API_KEY=process.env.OPENAI_API_KEY\n", "fixture")
  );
});
