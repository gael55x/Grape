import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");
const fixturesRoot = path.join(process.cwd(), "tests/fixtures");
const cleanFixturePath = path.join(fixturesRoot, "clean-typescript-app");
const branchFixturePath = path.join(fixturesRoot, "branch-switch-typescript-app");
const dirtyWorktreeFixturePath = path.join(fixturesRoot, "dirty-worktree-typescript-app");
const staleFixturePath = path.join(fixturesRoot, "stale-source-typescript-app");
const sessionResetFixturePath = path.join(fixturesRoot, "session-reset-typescript-app");
const polyglotFixturePath = path.join(fixturesRoot, "polyglot-fallback-repo");
const monorepoFixturePath = path.join(fixturesRoot, "monorepo-lite-repo");

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

test("cli bench reports deterministic token reduction for a named fixture", () => {
  const result = runCli([
    "bench",
    "--fixture",
    "clean-typescript-app",
    "--fixture-path",
    cleanFixturePath,
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  assert.equal(output.benchmark, "bench_token_reduction_after_first_turn");
  assert.equal(output.fixture, "clean-typescript-app");
  assert.equal(output.task, "Explain calculateDiscount behavior and the tests that cover it.");
  assert.equal(output.status, "pass");
  assert.equal(output.workspacePath, undefined);
  assert.equal(output.turns.length, 2);
  assert.equal(output.turns[0].turn, 1);
  assert.equal(output.turns[1].turn, 2);
  assert.equal(output.thresholds.maxFirstTurnOverheadPercent, 10);
  assert.equal(output.thresholds.maxFirstTurnAgentOutputOverheadPercent, 400);
  assert.equal(output.thresholds.maxSecondTurnStorageGrowthBytes, 5 * 1024 * 1024);
  assert.equal(output.noChangeSync.benchmark, "bench_no_change_sync_time");
  assert.equal(output.noChangeSync.status, "pass");
  assert.equal(output.noChangeSync.thresholds.maxSecondTurnDurationRatio, 2);
  assert.equal(output.noChangeSync.thresholds.requireCleanSecondTurn, true);
  assert.equal(output.noChangeSync.thresholds.requireSecondTurnOmission, true);
  assert.equal(output.noChangeSync.thresholds.requireZeroUnsafeOmissions, true);
  assert.equal(output.noChangeSync.thresholds.requireZeroStaleItemsSent, true);
  assert.equal(output.noChangeSync.firstTurnDurationMs, output.turns[0].durationMs);
  assert.equal(output.noChangeSync.secondTurnDurationMs, output.turns[1].durationMs);
  assert.equal(
    output.noChangeSync.secondTurnDurationRatio <= output.noChangeSync.thresholds.maxSecondTurnDurationRatio,
    true
  );
  assert.equal(output.noChangeSync.secondTurnOmittedItemCount, output.turns[1].omittedItemCount);
  assert.equal(output.noChangeSync.secondTurnRestoreAvailableCount, output.turns[1].restoreAvailableCount);
  assert.equal(output.noChangeSync.secondTurnDirtyWorktree, false);
  assert.deepEqual(output.noChangeSync.failures, []);
  assert.equal(output.turns[0].overheadPercent <= output.thresholds.maxFirstTurnOverheadPercent, true);
  assert.equal(
    output.turns[0].agentOutputOverheadPercent <= output.thresholds.maxFirstTurnAgentOutputOverheadPercent,
    true
  );
  assert.equal(output.turns[0].serializedPackTokens > 0, true);
  assert.equal(output.turns[0].serializedAgentOutputTokens > 0, true);
  assert.equal(output.turns[0].serializedAgentStructuredTokens > 0, true);
  assert.equal(output.turns[0].serializedAgentTextTokens > 0, true);
  assert.equal(output.turns[0].storageFootprint.grapeBytes > 0, true);
  assert.equal(output.turns[0].storageFootprint.databaseBytes > 0, true);
  assert.equal(output.turns[0].storageFootprint.artifactJsonBytes > 0, true);
  assert.equal(output.turns[0].storageFootprint.artifactMarkdownBytes > 0, true);
  assert.equal(output.turns[0].storageFootprint.artifactRepositoryBytes > 0, true);
  assert.equal(
    output.turns[1].storageFootprint.grapeBytes - output.turns[0].storageFootprint.grapeBytes <=
      output.thresholds.maxSecondTurnStorageGrowthBytes,
    true
  );
  assert.equal(
    output.totals.secondTurnStorageGrowthBytes,
    output.turns[1].storageFootprint.grapeBytes - output.turns[0].storageFootprint.grapeBytes
  );
  assert.equal(output.totals.serializedPackTokens > 0, true);
  assert.equal(output.totals.serializedAgentOutputTokens > 0, true);
  assert.equal(typeof output.totals.firstTurnAgentOutputOverheadPercent, "number");
  assert.equal(output.totals.firstTurnNaiveTokens > 0, true);
  assert.equal(typeof output.totals.firstTurnOverheadPercent, "number");
  assert.equal(output.turns[0].stateTokenBreakdown.some((entry) => entry.state === "NEW"), true);
  assert.equal(output.turns[0].sectionTokenBreakdown.length > 0, true);
  assert.equal(output.turns[1].stateCounts.OMIT_UNCHANGED > 0, true);
  assert.equal(output.turns[1].restoreAvailableCount > 0, true);
  assert.equal(output.turns[1].unsafeOmissions, 0);
  assert.equal(output.turns[1].staleItemsSent, 0);
  assert.equal(
    output.turns[1].reductionPercent >= output.thresholds.minSecondTurnReductionPercent,
    true
  );
  assert.deepEqual(output.failures, []);
});

test("cli bench human output reports storage footprint", () => {
  const result = runCli([
    "bench",
    "--fixture",
    "clean-typescript-app",
    "--fixture-path",
    cleanFixturePath
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /storage bytes: \.grape=/);
  assert.match(result.stdout, /Second-turn \.grape byte growth:/);
  assert.match(result.stdout, /No-change sync gate: pass/);
});

test("cli bench branch-switch fixture reports invalidation on feature branch", () => {
  const result = runCli([
    "bench",
    "--fixture",
    "branch-switch-typescript-app",
    "--fixture-path",
    branchFixturePath,
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.benchmark, "bench_branch_switch_invalidation");
  assert.equal(output.fixture, "branch-switch-typescript-app");
  assert.equal(output.status, "pass");
  assert.equal(output.turns[1].stateCounts.INVALIDATE_PREVIOUS > 0, true);
  assert.deepEqual(output.failures, []);
});

test("cli bench dirty-worktree fixture reports invalidation on uncommitted source edit", () => {
  const result = runCli([
    "bench",
    "--fixture",
    "dirty-worktree-typescript-app",
    "--fixture-path",
    dirtyWorktreeFixturePath,
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.benchmark, "bench_dirty_worktree_invalidation");
  assert.equal(output.fixture, "dirty-worktree-typescript-app");
  assert.equal(output.status, "pass");
  assert.equal(output.scenario.editedSourceRef, "src/calculateDiscount.ts");
  assert.equal(output.scenario.sourceWasTracked, true);
  assert.equal(output.scenario.sourceCleanBeforeEdit, true);
  assert.equal(output.scenario.sourceDirtyAfterEdit, true);
  assert.deepEqual(output.scenario.dirtyStatusAfterEdit, ["M src/calculateDiscount.ts"]);
  assert.equal(output.scenario.dirtyWorktreeReported, true);
  assert.equal(output.scenario.invalidationItemsReferencingEditedSource > 0, true);
  assert.equal(output.scenario.omittedUnchangedAfterEdit, 0);
  assert.equal(output.turns[1].dirtyWorktree, true);
  assert.equal(output.turns[1].stateCounts.INVALIDATE_PREVIOUS > 0, true);
  assert.equal(output.turns[1].stateCounts.OMIT_UNCHANGED ?? 0, 0);
  assert.equal(output.turns[1].unsafeOmissions, 0);
  assert.equal(output.turns[1].staleItemsSent, 0);
  assert.equal(
    output.turns[1].sectionTokenBreakdown.some(
      (entry) =>
        entry.state === "INVALIDATE_PREVIOUS" &&
        entry.inputRefs.includes("src/calculateDiscount.ts")
    ),
    true
  );
  assert.deepEqual(output.failures, []);
});

test("cli bench stale-source fixture reports invalidation after source edit", () => {
  const result = runCli([
    "bench",
    "--fixture",
    "stale-source-typescript-app",
    "--fixture-path",
    staleFixturePath,
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.benchmark, "bench_stale_source_invalidation");
  assert.equal(output.fixture, "stale-source-typescript-app");
  assert.equal(output.status, "pass");
  assert.equal(output.changedFileInvalidation.benchmark, "bench_changed_file_invalidation_time");
  assert.equal(output.changedFileInvalidation.status, "pass");
  assert.equal(output.changedFileInvalidation.changedSourceRef, "src/calculateDiscount.ts");
  assert.equal(output.changedFileInvalidation.thresholds.maxSecondTurnDurationMs, 5000);
  assert.equal(output.changedFileInvalidation.thresholds.requireSourceEditApplied, true);
  assert.equal(output.changedFileInvalidation.thresholds.requireInvalidatePrevious, true);
  assert.equal(output.changedFileInvalidation.thresholds.requireChangedSourceInvalidation, true);
  assert.equal(output.changedFileInvalidation.thresholds.requireNoOmitUnchangedAfterChange, true);
  assert.equal(output.changedFileInvalidation.thresholds.requireZeroUnsafeOmissions, true);
  assert.equal(output.changedFileInvalidation.thresholds.requireZeroStaleItemsSent, true);
  assert.equal(output.changedFileInvalidation.firstTurnDurationMs, output.turns[0].durationMs);
  assert.equal(output.changedFileInvalidation.secondTurnDurationMs, output.turns[1].durationMs);
  assert.equal(
    output.changedFileInvalidation.secondTurnDurationMs <=
      output.changedFileInvalidation.thresholds.maxSecondTurnDurationMs,
    true
  );
  assert.equal(output.changedFileInvalidation.secondTurnInvalidationItemCount, output.turns[1].invalidationItemCount);
  assert.equal(
    output.changedFileInvalidation.secondTurnOmitUnchangedCount,
    output.turns[1].stateCounts.OMIT_UNCHANGED ?? 0
  );
  assert.equal(output.changedFileInvalidation.invalidationItemsReferencingChangedSource > 0, true);
  assert.equal(output.changedFileInvalidation.changedSourceEditApplied, true);
  assert.equal(output.changedFileInvalidation.secondTurnDirtyWorktree, true);
  assert.deepEqual(output.changedFileInvalidation.failures, []);
  assert.equal(output.turns[1].stateCounts.INVALIDATE_PREVIOUS > 0, true);
  assert.deepEqual(output.failures, []);
});

test("cli bench stale-source human output reports changed-file invalidation gate", () => {
  const result = runCli([
    "bench",
    "--fixture",
    "stale-source-typescript-app",
    "--fixture-path",
    staleFixturePath
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Changed-file invalidation gate: pass/);
  assert.match(result.stdout, /Changed-source invalidations: [1-9]/);
});

test("cli bench session-reset fixture reports invalidation and full resend after reset", () => {
  const result = runCli([
    "bench",
    "--fixture",
    "session-reset-typescript-app",
    "--fixture-path",
    sessionResetFixturePath,
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.benchmark, "bench_diff_vs_naive_resend");
  assert.equal(output.fixture, "session-reset-typescript-app");
  assert.equal(output.task, "Explain session reset handling and the tests that cover it.");
  assert.equal(output.status, "pass");
  assert.equal(output.turns[1].stateCounts.INVALIDATE_PREVIOUS > 0, true);
  assert.equal(output.turns[1].stateCounts.NEW > 0, true);
  assert.equal(output.turns[1].stateCounts.OMIT_UNCHANGED ?? 0, 0);
  assert.deepEqual(output.failures, []);
});

test("cli bench polyglot fixture uses fixture metadata task", () => {
  const result = runCli([
    "bench",
    "--fixture",
    "polyglot-fallback-repo",
    "--fixture-path",
    polyglotFixturePath,
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.benchmark, "bench_token_reduction_after_first_turn");
  assert.equal(output.fixture, "polyglot-fallback-repo");
  assert.match(output.task, /calculate_member_total/);
  assert.doesNotMatch(output.task, /calculateDiscount/);
  assert.equal(output.status, "pass");
  assert.equal(output.turns[1].stateCounts.OMIT_UNCHANGED > 0, true);
  assert.equal(output.turns[1].restoreAvailableCount > 0, true);
  assert.equal(output.turns[1].unsafeOmissions, 0);
  assert.deepEqual(output.failures, []);
});

test("cli bench monorepo fixture uses fixture metadata task", () => {
  const result = runCli([
    "bench",
    "--fixture",
    "monorepo-lite-repo",
    "--fixture-path",
    monorepoFixturePath,
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.benchmark, "bench_token_reduction_after_first_turn");
  assert.equal(output.fixture, "monorepo-lite-repo");
  assert.match(output.task, /apiBillingTotal/);
  assert.doesNotMatch(output.task, /calculateDiscount/);
  assert.equal(output.status, "pass");
  assert.equal(output.turns[1].stateCounts.OMIT_UNCHANGED > 0, true);
  assert.equal(output.turns[1].restoreAvailableCount > 0, true);
  assert.equal(output.turns[1].unsafeOmissions, 0);
  assert.deepEqual(output.failures, []);
});

test("cli bench does not copy fixture metadata into the prepared repo", () => {
  const result = runCli([
    "bench",
    "--fixture",
    "clean-typescript-app",
    "--fixture-path",
    cleanFixturePath,
    "--keep-workspace",
    "--json"
  ]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  try {
    assert.equal(typeof output.workspacePath, "string");
    assert.equal(existsSync(path.join(output.workspacePath, "clean-typescript-app", "grape-fixture.json")), false);
  } finally {
    if (typeof output.workspacePath === "string") {
      rmSync(output.workspacePath, { recursive: true, force: true });
    }
  }
});

test("cli bench requires a named fixture", () => {
  const result = runCli(["bench", "--json"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /grape bench requires --fixture <name>/);
});
