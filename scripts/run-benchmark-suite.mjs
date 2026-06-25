import { spawnSync } from "node:child_process";
import path from "node:path";
import { commandForPlatform, spawnOptionsForPlatform } from "./platform-command.mjs";

const root = process.cwd();
const cliPath = path.join(root, ".tmp/build/src/cli/index.js");
const fixtures = [
  "clean-typescript-app",
  "branch-switch-typescript-app",
  "dirty-worktree-typescript-app",
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
  const first = output.turns?.[0];
  const second = output.turns?.[1];
  const last = output.turns?.at(-1);
  rows.push({
    fixture,
    benchmark: output.benchmark,
    status: output.status,
    turn1Tokens: first?.grapeTokens,
    turn1OverheadPercent: first?.overheadPercent,
    turn2Tokens: second?.grapeTokens,
    turn2ReductionPercent: second?.reductionPercent ?? output.totals?.secondTurnReductionPercent,
    serializedPackTokens:
      output.totals?.serializedPackTokens ??
      output.turns?.reduce((total, turn) => total + (turn.serializedPackTokens ?? 0), 0),
    serializedAgentOutputTokens:
      output.totals?.serializedAgentOutputTokens ??
      output.turns?.reduce((total, turn) => total + (turn.serializedAgentOutputTokens ?? 0), 0),
    firstTurnAgentOutputOverheadPercent:
      output.totals?.firstTurnAgentOutputOverheadPercent ?? first?.agentOutputOverheadPercent,
    storageGrapeBytesFinal: last?.storageFootprint?.grapeBytes,
    storageGrapeBytesGrowth:
      first?.storageFootprint && last?.storageFootprint
        ? last.storageFootprint.grapeBytes - first.storageFootprint.grapeBytes
        : undefined,
    storageDatabaseBytesFinal: last?.storageFootprint?.databaseBytes,
    storageWalBytesFinal: last?.storageFootprint?.databaseWalBytes,
    storageShmBytesFinal: last?.storageFootprint?.databaseShmBytes,
    storageArtifactBytesFinal: last?.storageFootprint?.artifactBytes,
    storageArtifactBytesGrowth:
      first?.storageFootprint && last?.storageFootprint
        ? last.storageFootprint.artifactBytes - first.storageFootprint.artifactBytes
        : undefined,
    storageArtifactJsonBytesFinal: last?.storageFootprint?.artifactJsonBytes,
    storageArtifactMarkdownBytesFinal: last?.storageFootprint?.artifactMarkdownBytes,
    storageArtifactRepositoryBytesFinal: last?.storageFootprint?.artifactRepositoryBytes,
    noChangeSyncStatus: output.noChangeSync?.status,
    noChangeSyncDurationRatio: output.noChangeSync?.secondTurnDurationRatio,
    noChangeSyncMaxDurationRatio: output.noChangeSync?.thresholds?.maxSecondTurnDurationRatio,
    dirtyScenario: output.scenario,
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
      `  storageGrapeBytesFinal=${row.storageGrapeBytesFinal ?? "n/a"} storageGrapeBytesGrowth=${row.storageGrapeBytesGrowth ?? "n/a"} storageDbBytesFinal=${row.storageDatabaseBytesFinal ?? "n/a"} storageWalBytesFinal=${row.storageWalBytesFinal ?? "n/a"} storageShmBytesFinal=${row.storageShmBytesFinal ?? "n/a"}`,
      `  storageArtifactBytesFinal=${row.storageArtifactBytesFinal ?? "n/a"} storageArtifactBytesGrowth=${row.storageArtifactBytesGrowth ?? "n/a"} artifactJson=${row.storageArtifactJsonBytesFinal ?? "n/a"} artifactMarkdown=${row.storageArtifactMarkdownBytesFinal ?? "n/a"} artifactRepository=${row.storageArtifactRepositoryBytesFinal ?? "n/a"}`,
      row.noChangeSyncStatus
        ? `  noChangeSync=${row.noChangeSyncStatus} turn2OverTurn1=${row.noChangeSyncDurationRatio ?? "n/a"}x max=${row.noChangeSyncMaxDurationRatio ?? "n/a"}x`
        : undefined,
      row.dirtyScenario
        ? `  dirtyScenario source=${row.dirtyScenario.editedSourceRef} tracked=${row.dirtyScenario.sourceWasTracked} dirty=${row.dirtyScenario.sourceDirtyAfterEdit} compileDirty=${row.dirtyScenario.dirtyWorktreeReported} sourceInvalidations=${row.dirtyScenario.invalidationItemsReferencingEditedSource} omitUnchanged=${row.dirtyScenario.omittedUnchangedAfterEdit}`
        : undefined,
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
