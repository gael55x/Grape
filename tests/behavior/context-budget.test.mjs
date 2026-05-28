import assert from "node:assert/strict";
import test from "node:test";

import {
  applyInMemoryContextPackBudget,
  buildV1ContextArtifact,
  evaluateContextPackBudget
} from "../../.tmp/build/src/core/compiler/index.js";

test("context budget evaluator reports over-budget packs without pruning required context", () => {
  const result = evaluateContextPackBudget({
    tokenBudget: 10,
    estimatedPackTokens: 20,
    contextPackItems: [
      packItem("rules", 4, { pinned: true }),
      packItem("summary", 16)
    ]
  });

  assert.equal(result.status, "over_budget");
  assert.equal(result.requiredContextTokens, 4);
  assert.deepEqual(result.omittedDueToBudget, []);
  assert.deepEqual(result.warnings, ["token_budget_exceeded_without_pruning"]);
  assert.deepEqual(result.unsafeReasons, []);
});

test("context budget evaluator rejects budgets below required context", () => {
  const result = evaluateContextPackBudget({
    tokenBudget: 3,
    estimatedPackTokens: 20,
    contextPackItems: [
      packItem("rules", 4, { pinned: true }),
      packItem("summary", 16)
    ]
  });

  assert.equal(result.status, "required_context_exceeds_budget");
  assert.deepEqual(result.omittedDueToBudget, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.unsafeReasons, ["token_budget_below_required_context"]);
});

test("context budget pruning drops optional items without dropping required context", () => {
  const artifact = artifactShape([
    section("task", { type: "task", body: "Budget the requested compile task." }),
    section("repo-state", { type: "risk_warning", body: "Branch main at abc123.", pinned: true }),
    section("exact-source-evidence", {
      type: "code_span",
      body: "function verifyPayment() { return true; }",
      exactRequired: true
    }),
    section("source-manifest", { type: "compression_orientation", body: "x".repeat(320) }),
    section("compression-orientation", { type: "compression_orientation", body: "y".repeat(320) })
  ]);
  const result = applyInMemoryContextPackBudget({
    tokenBudget: 40,
    artifact,
    contextPackItems: [
      inMemoryPackItem("task", 2),
      inMemoryPackItem("repo-state", 2, { state: "PINNED", pinned: true }),
      inMemoryPackItem("exact-source-evidence", 10),
      inMemoryPackItem("source-manifest", 80),
      inMemoryPackItem("compression-orientation", 80),
      inMemoryPackItem("source-manifest", 2, {
        itemId: "invalidate-source-manifest",
        state: "INVALIDATE_PREVIOUS",
        previousItemId: "previous-source-manifest"
      })
    ]
  });

  const emittedSectionIds = result.contextPackItems.map((item) => item.sectionId);
  assert.equal(result.budget.status, "within_budget");
  assert.equal(result.budget.warnings.includes("token_budget_pruned_optional_context"), true);
  assert.equal(emittedSectionIds.includes("task"), true);
  assert.equal(emittedSectionIds.includes("repo-state"), true);
  assert.equal(emittedSectionIds.includes("exact-source-evidence"), true);
  assert.equal(result.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"), true);
  assert.equal(emittedSectionIds.includes("compression-orientation"), false);
  assert.ok(result.budget.omittedDueToBudget.some((item) => item.sectionId === "compression-orientation"));
});

test("budget-omitted sections are removed from the public context artifact body", () => {
  const artifact = artifactShape([
    section("task", { type: "task", body: "Budget the requested compile task." }),
    section("repo-state", { type: "risk_warning", body: "Branch main at abc123.", pinned: true }),
    section("source-manifest", { type: "compression_orientation", body: "x".repeat(320) })
  ]);
  const budgeted = applyInMemoryContextPackBudget({
    tokenBudget: 16,
    artifact,
    contextPackItems: [
      inMemoryPackItem("task", 2),
      inMemoryPackItem("repo-state", 2, { state: "PINNED", pinned: true }),
      inMemoryPackItem("source-manifest", 80)
    ]
  });
  const publicArtifact = buildV1ContextArtifact({
    artifact,
    projectId: "project-1",
    repoSnapshotId: "snapshot-1",
    worktreeStateId: "worktree-1",
    dirtyWorktree: false,
    budget: budgeted.budget,
    tokenCost: budgeted.budget.estimatedPackTokens
  });

  assert.equal(publicArtifact.outputSections.some((item) => item.id === "task"), true);
  assert.equal(publicArtifact.outputSections.some((item) => item.id === "repo-state"), true);
  assert.equal(publicArtifact.outputSections.some((item) => item.id === "source-manifest"), false);
  assert.deepEqual(
    publicArtifact.omittedDueToBudget.map((item) => item.itemRef),
    ["source-manifest"]
  );
});

function packItem(id, tokenCount, overrides = {}) {
  return {
    id,
    state: overrides.state ?? "NEW",
    itemKind: "context_summary",
    itemRef: id,
    sectionId: id,
    title: id,
    content: "x".repeat(tokenCount * 4),
    contentHash: "a".repeat(64),
    tokenCount,
    pinned: overrides.pinned ?? false,
    safetyCritical: overrides.safetyCritical ?? false,
    inputRefs: [],
    warnings: []
  };
}

function inMemoryPackItem(sectionId, tokenCount, overrides = {}) {
  return {
    itemId: overrides.itemId ?? sectionId,
    artifactId: "artifact:budget-test",
    sessionId: "session-1",
    sectionId,
    state: overrides.state ?? "NEW",
    title: sectionId,
    body: "x".repeat(tokenCount * 4),
    contentHash: `${sectionId}-hash`,
    previousItemId: overrides.previousItemId,
    restoreToken: overrides.restoreToken,
    safeOmissionReason: overrides.safeOmissionReason,
    pinned: overrides.pinned ?? false,
    warnings: []
  };
}

function artifactShape(sections) {
  return {
    artifactId: "artifact:budget-test",
    input: {
      taskId: "task-1",
      sessionId: "session-1",
      repoId: "repo-1",
      branch: "main",
      commit: "abc123",
      worktreeHash: "worktree-hash",
      taskType: "analysis",
      riskOverlays: [],
      userRequestHash: "user-request-hash"
    },
    sections,
    dependencyManifest: {
      manifestId: "manifest-1",
      dependencies: [],
      createdAt: "2026-05-28T00:00:00.000Z",
      hashAlgorithm: "sha256",
      manifestHash: "manifest-hash"
    },
    warnings: [],
    unsafeReasons: [],
    createdAt: "2026-05-28T00:00:00.000Z",
    artifactHash: "artifact-hash"
  };
}

function section(id, overrides = {}) {
  return {
    id,
    type: overrides.type ?? "task",
    title: overrides.title ?? id,
    body: overrides.body ?? id,
    sourceRefs: [],
    proofRefs: [],
    dependencyRefs: [],
    contentHash: `${id}-hash`,
    pinned: overrides.pinned ?? false,
    exactRequired: overrides.exactRequired ?? false,
    redactionStatus: "clean"
  };
}
