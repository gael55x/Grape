import { spawnSync } from "node:child_process";
import path from "node:path";
import { commandForPlatform, spawnOptionsForPlatform } from "./platform-command.mjs";

const root = process.cwd();
const cliPath = path.join(root, ".tmp/build/src/cli/index.js");
const fixtures = [
  "clean-typescript-app",
  "branch-switch-typescript-app",
  "stale-source-typescript-app",
  "session-reset-typescript-app",
  "polyglot-fallback-repo",
  "monorepo-lite-repo"
];

const clean = spawnSync(process.execPath, ["scripts/clean-test-build.mjs"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});
if (clean.status !== 0) {
  console.error(clean.stderr.trim());
  process.exit(clean.status ?? 1);
}

const build = spawnSync(
  commandForPlatform("npm"),
  ["run", "build:test"],
  spawnOptionsForPlatform({
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  })
);
if (build.status !== 0) {
  console.error(build.stderr.trim());
  process.exit(build.status ?? 1);
}

const rows = [];
let failed = 0;

for (const fixture of fixtures) {
  const fixturePath = path.join(root, "tests/fixtures", fixture);
  const result = spawnSync(
    process.execPath,
    [cliPath, "bench", "--fixture", fixture, "--fixture-path", fixturePath, "--json"],
    { cwd: root, encoding: "utf8" }
  );

  if (result.status !== 0) {
    failed += 1;
    rows.push({ fixture, status: "error", detail: result.stderr.trim() || result.stdout.trim() });
    continue;
  }

  const output = JSON.parse(result.stdout);
  const second = output.turns?.[1];
  rows.push({
    fixture,
    benchmark: output.benchmark,
    status: output.status,
    turn1Tokens: output.turns?.[0]?.grapeTokens,
    turn1OverheadPercent: output.turns?.[0]?.overheadPercent,
    turn2Tokens: second?.grapeTokens,
    turn2ReductionPercent: second?.reductionPercent ?? output.totals?.secondTurnReductionPercent,
    serializedPackTokens:
      output.totals?.serializedPackTokens ??
      output.turns?.reduce((total, turn) => total + (turn.serializedPackTokens ?? 0), 0),
    serializedAgentOutputTokens:
      output.totals?.serializedAgentOutputTokens ??
      output.turns?.reduce((total, turn) => total + (turn.serializedAgentOutputTokens ?? 0), 0),
    firstTurnAgentOutputOverheadPercent:
      output.totals?.firstTurnAgentOutputOverheadPercent ?? output.turns?.[0]?.agentOutputOverheadPercent,
    omitUnchanged: second?.stateCounts?.OMIT_UNCHANGED ?? 0,
    invalidatePrevious: second?.stateCounts?.INVALIDATE_PREVIOUS ?? 0,
    unsafeOmissions: second?.unsafeOmissions ?? 0,
    failures: output.failures
  });
  if (output.status !== "pass") failed += 1;
}

console.log("Grape benchmark suite\n");
for (const row of rows) {
  if (row.status === "error") {
    console.log(`- ${row.fixture}: ERROR ${row.detail}`);
    continue;
  }
  console.log(
    [
      `- ${row.fixture} (${row.benchmark}): ${row.status}`,
      `  turn1=${row.turn1Tokens} overhead=${row.turn1OverheadPercent ?? "n/a"}% turn2=${row.turn2Tokens} reduction=${row.turn2ReductionPercent ?? "n/a"}%`,
      `  serializedPackTokens=${row.serializedPackTokens ?? "n/a"} serializedAgentOutputTokens=${row.serializedAgentOutputTokens ?? "n/a"} agentOutputOverhead=${row.firstTurnAgentOutputOverheadPercent ?? "n/a"}%`,
      `  OMIT_UNCHANGED=${row.omitUnchanged} INVALIDATE_PREVIOUS=${row.invalidatePrevious} unsafe=${row.unsafeOmissions}`,
      row.failures?.length ? `  failures=${row.failures.join(", ")}` : undefined
    ]
      .filter(Boolean)
      .join("\n")
  );
}

if (failed > 0) {
  console.error(`\nbenchmark suite failed: ${failed} fixture(s)`);
  process.exit(1);
}

console.log("\nbenchmark suite ok");
