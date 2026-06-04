import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateInMemoryTokenSavings,
  createInMemoryContextDiff
} from "../../../.tmp/build/src/core/diff/index.js";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

function section(overrides) {
  return {
    id: "claim",
    type: "active_claim",
    title: "Discount claim",
    body: "calculateDiscount returns a member discount for positive subtotals.",
    sourceRefs: ["src/calculateDiscount.ts"],
    proofRefs: ["proof-1"],
    dependencyRefs: ["dep-1"],
    contentHash: hashA,
    pinned: false,
    exactRequired: true,
    redactionStatus: "clean",
    ...overrides
  };
}

function artifact(sections) {
  return {
    artifactId: "artifact-1",
    input: {
      taskId: "task-1",
      sessionId: "session-1",
      repoId: "repo-1",
      branch: "main",
      commit: "abc123",
      worktreeHash: hashA,
      taskType: "analysis",
      riskOverlays: [],
      userRequestHash: hashB
    },
    sections,
    dependencyManifest: {
      manifestId: "manifest-1",
      dependencies: [
        {
          id: "dep-1",
          kind: "source_file",
          ref: "src/calculateDiscount.ts",
          hash: hashA,
          scope: { branch: "main" }
        }
      ],
      createdAt: "2026-05-24T00:00:00.000Z",
      hashAlgorithm: "sha256",
      manifestHash: hashB
    },
    warnings: [],
    unsafeReasons: [],
    createdAt: "2026-05-24T00:00:00.000Z",
    artifactHash: hashA
  };
}

test("in-memory diff resends pinned sections and sends new ordinary sections", () => {
  const pinned = section({
    id: "rule",
    type: "pinned_rule",
    title: "Pinned rule",
    body: "Never omit safety-critical project rules.",
    pinned: true
  });
  const ordinary = section({ id: "claim" });

  const result = createInMemoryContextDiff({
    sessionId: "session-1",
    artifact: artifact([pinned, ordinary]),
    previouslySent: []
  });

  assert.deepEqual(
    result.contextPackItems.map((item) => item.state),
    ["PINNED", "NEW"]
  );
  assert.equal(result.unsafeOmissions, 0);
});

test("in-memory diff omits unchanged non-pinned sections with restore metadata", () => {
  const ordinary = section({ id: "claim" });

  const result = createInMemoryContextDiff({
    sessionId: "session-1",
    artifact: artifact([ordinary]),
    previouslySent: [
      {
        itemId: "sent-1",
        sessionId: "session-1",
        artifactId: "artifact-previous",
        sectionId: "claim",
        contentHash: hashA,
        pinned: false
      }
    ]
  });

  assert.deepEqual(
    result.contextPackItems.map((item) => item.state),
    ["OMIT_UNCHANGED", "RESTORE_AVAILABLE"]
  );
  assert.equal(result.omittedItems.length, 1);
  assert.equal(result.omittedItems[0].reason, "unchanged_restorable");
  assert.equal(result.contextPackItems[0].safeOmissionReason, "unchanged_restorable");
  assert.ok(result.contextPackItems[0].restoreToken);
  assert.equal(result.unsafeOmissions, 0);
});

test("in-memory token accounting reports naive versus grape cost", () => {
  const ordinary = section({ id: "claim" });
  const diff = createInMemoryContextDiff({
    sessionId: "session-1",
    artifact: artifact([ordinary]),
    previouslySent: [
      {
        itemId: "sent-1",
        sessionId: "session-1",
        artifactId: "artifact-previous",
        sectionId: "claim",
        contentHash: hashA,
        pinned: false
      }
    ]
  });

  const metric = calculateInMemoryTokenSavings({
    fixture: "clean-typescript-app",
    taskId: "task-1",
    turn: 2,
    selectedSections: [ordinary],
    contextPackItems: diff.contextPackItems,
    unsafeOmissions: diff.unsafeOmissions
  });

  assert.equal(metric.fixture, "clean-typescript-app");
  assert.equal(metric.compressionSavedTokens, 0);
  assert.equal(metric.unsafeOmissions, 0);
  assert.equal(metric.staleItemsSent, 0);
  assert.ok(metric.naiveTokens > 0);
  assert.ok(metric.grapeTokens > 0);
  assert.ok(metric.omittedUnchangedTokens > 0);
});
