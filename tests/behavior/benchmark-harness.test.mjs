import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");
const cleanFixturePath = path.join(process.cwd(), "tests/fixtures/clean-typescript-app");

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
  assert.equal(output.status, "pass");
  assert.equal(output.workspacePath, undefined);
  assert.equal(output.turns.length, 2);
  assert.equal(output.turns[0].turn, 1);
  assert.equal(output.turns[1].turn, 2);
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

test("cli bench requires a named fixture", () => {
  const result = runCli(["bench", "--json"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /grape bench requires --fixture <name>/);
});
