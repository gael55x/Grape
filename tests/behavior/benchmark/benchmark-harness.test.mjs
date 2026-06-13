import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");
const fixturesRoot = path.join(process.cwd(), "tests/fixtures");
const cleanFixturePath = path.join(fixturesRoot, "clean-typescript-app");
const branchFixturePath = path.join(fixturesRoot, "branch-switch-typescript-app");
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
  assert.equal(output.turns[0].overheadPercent <= output.thresholds.maxFirstTurnOverheadPercent, true);
  assert.equal(
    output.turns[0].agentOutputOverheadPercent <= output.thresholds.maxFirstTurnAgentOutputOverheadPercent,
    true
  );
  assert.equal(output.turns[0].serializedPackTokens > 0, true);
  assert.equal(output.turns[0].serializedAgentOutputTokens > 0, true);
  assert.equal(output.turns[0].serializedAgentStructuredTokens > 0, true);
  assert.equal(output.turns[0].serializedAgentTextTokens > 0, true);
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
  assert.equal(output.turns[1].stateCounts.INVALIDATE_PREVIOUS > 0, true);
  assert.deepEqual(output.failures, []);
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
