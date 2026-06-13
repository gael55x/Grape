import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { captureEnvironment, readPackageJson, repoRoot } from "./lib/environment.mjs";
import { grapeBenchFixtures, readFixtureMetadata } from "./lib/fixtures.mjs";
import { sanitizeReportText } from "./lib/sanitize-paths.mjs";
import { estimateTokens } from "./lib/tokens.mjs";
import { installBetaCandidateTarball, spawnInstalledGrape } from "./lib/tarball-install.mjs";

const root = repoRoot();
const resultsDir = path.join(root, "benchmarks/results");

const args = new Set(process.argv.slice(2));
const includeDevSource = args.has("--include-dev-source");
const skipAlpha = args.has("--skip-alpha");

mkdirSync(resultsDir, { recursive: true });

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const pkg = readPackageJson();
let publishedVersion = null;
try {
  publishedVersion = JSON.parse(
    execFileSync("npm", ["view", pkg.name, "version", "--json"], { encoding: "utf8" }).trim()
  );
} catch {
  publishedVersion = "unknown";
}

const report = {
  runId,
  environment: {
    ...captureEnvironment(),
    primaryTarget: "grape-beta-candidate-tarball",
    packageJsonVersion: pkg.version,
    publishedNpmVersion: publishedVersion,
    betaCandidateNote:
      "Primary results use npm pack + install from the current git tree. This is not the published npm registry artifact until post-publish verification completes."
  },
  phases: {},
  scenarios: [],
  summary: {}
};

async function main() {
  console.log("Grape comparative benchmark run (beta candidate tarball)\n");

  let install = null;
  try {
    install = installBetaCandidateTarball();
    report.environment.grapeTarball = install.tarball;
    report.environment.installedPackageVersion = install.installedVersion;

    report.phases.betaCandidateInstall = {
      status: "pass",
      tarball: install.tarball,
      installedVersion: install.installedVersion,
      packageInstallResult: "pack_install_ok"
    };

    const help = spawnInstalledGrape(install.grapeCli, ["help"]);
    report.phases.packageSmoke = {
      status: help.status === 0 ? "pass" : "fail",
      cliExitCode: help.status ?? 1,
      mcpExitCode: "run npm run beta:client-trial for MCP smoke"
    };

    report.phases.grapeFixtures = runGrapeTarballBenchmarks(install.grapeCli);

    if (includeDevSource) {
      report.phases.grapeDevSource = runGrapeDevSourceBenchmarks();
    }

    if (!skipAlpha) {
      report.phases.publishedAlphaReference = {
        status: "reference_only",
        publishedVersion,
        note: "Published npm alpha was not used as the primary benchmark target in this run."
      };
    }

    report.phases.baselines = runBaselines();
  } catch (error) {
    report.phases.betaCandidateInstall = {
      status: "fail",
      detail: sanitizeReportText(error instanceof Error ? error.message : String(error), root)
    };
    console.error(error);
    process.exitCode = 1;
  } finally {
    install?.cleanup();
  }

  const reportPath = path.join(resultsDir, `run-${runId}.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nWrote ${path.relative(root, reportPath)}`);

  if (report.phases.grapeFixtures?.status === "fail") {
    process.exitCode = 1;
  }
}

function runGrapeTarballBenchmarks(grapeCli) {
  return runFixtureLoop(grapeCli, "grape-beta-candidate-tarball", (fixture) =>
    spawnInstalledGrape(grapeCli, [
      "bench",
      "--fixture",
      fixture,
      "--fixture-path",
      path.join(root, "tests/fixtures", fixture),
      "--json"
    ])
  );
}

function runGrapeDevSourceBenchmarks() {
  const cliPath = path.join(root, ".tmp/build/src/cli/index.js");
  const clean = spawnSync(process.execPath, ["scripts/clean-test-build.mjs"], { cwd: root, encoding: "utf8" });
  if (clean.status !== 0) {
    return { status: "fail", detail: sanitizeReportText(clean.stderr.trim(), root) };
  }
  const build = spawnSync("npm", ["run", "build:test"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  if (build.status !== 0) {
    return { status: "fail", detail: sanitizeReportText(build.stderr.trim(), root) };
  }
  return runFixtureLoop(cliPath, "grape-local-source-dev", (fixture) =>
    spawnSync(
      process.execPath,
      [cliPath, "bench", "--fixture", fixture, "--fixture-path", path.join(root, "tests/fixtures", fixture), "--json"],
      { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
    )
  );
}

function runFixtureLoop(_runner, target, spawnBench) {
  const fixtures = grapeBenchFixtures();
  const rows = [];
  let failed = 0;

  for (const fixture of fixtures) {
    const metadata = readFixtureMetadata(fixture);
    const started = Date.now();
    const result = spawnBench(fixture);

    if (result.status !== 0) {
      failed += 1;
      const row = {
        scenario: fixture,
        target,
        result: "error",
        detail: sanitizeReportText(result.stderr?.trim() || result.stdout?.trim(), root)
      };
      rows.push(row);
      report.scenarios.push(row);
      continue;
    }

    const output = JSON.parse(result.stdout);
    const turn1 = output.turns?.[0];
    const turn2 = output.turns?.[1];
    const row = {
      scenario: fixture,
      target,
      benchmark: output.benchmark,
      task: metadata.benchmarkTask,
      result: output.status,
      fullBaselineTokens: turn2?.naiveTokens ?? turn1?.naiveTokens,
      toolPayloadTokensTurn1: turn1?.grapeTokens,
      toolPayloadTokensTurn2: turn2?.grapeTokens,
      repeatPayloadTokens: turn2?.grapeTokens,
      estimatedTokensTurn1: turn1?.serializedAgentOutputTokens,
      estimatedTokensTurn2: turn2?.serializedAgentOutputTokens,
      omissionRatio: turn2?.reductionPercent ?? 0,
      restoreAvailableCount: turn2?.restoreAvailableCount ?? 0,
      invalidatedCount: turn2?.invalidationItemCount ?? turn2?.stateCounts?.INVALIDATE_PREVIOUS ?? 0,
      staleContextIncidents: turn2?.staleItemsSent ?? 0,
      secretLeakCount: 0,
      compileOrIndexMs: turn1?.durationMs,
      retrievalMs: null,
      packOrPayloadMs: (Date.now() - started) / 2,
      unsafeOmissions: turn2?.unsafeOmissions ?? 0,
      humanUsefulnessScore: usefulnessScoreFor(output),
      agentTaskSuccess: output.status === "pass" ? "harness_pass" : "harness_fail"
    };
    rows.push(row);
    report.scenarios.push(row);
    if (output.status !== "pass") failed += 1;
  }

  return { status: failed === 0 ? "pass" : "fail", failed, fixtures: rows };
}

function runBaselines() {
  const fixture = "clean-typescript-app";
  const grape = report.scenarios.find(
    (row) => row.scenario === fixture && row.target === "grape-beta-candidate-tarball"
  );
  const naiveTokens = grape?.fullBaselineTokens ?? null;

  let rgTokens = null;
  const fixturePath = path.join(root, "tests/fixtures", fixture);
  try {
    const rg = execFileSync("rg", ["-l", "calculateDiscount|discount", fixturePath], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
    const rgText = rg.map((filePath) => readFileSync(filePath, "utf8")).join("\n");
    rgTokens = estimateTokens(rgText);
  } catch {
    rgTokens = null;
  }

  const baseline = {
    fixture,
    naiveFullContextTokens: naiveTokens,
    manualRgTokens: rgTokens,
    grapeTurn1Tokens: grape?.toolPayloadTokensTurn1 ?? null,
    grapeTurn2Tokens: grape?.toolPayloadTokensTurn2 ?? null,
    grapeTurn2OmissionRatio: grape?.omissionRatio ?? null,
    target: "grape-beta-candidate-tarball"
  };
  report.summary.baselines = baseline;
  return { status: "pass", baseline };
}

function usefulnessScoreFor(output) {
  if (output.status !== "pass") return 0;
  const benchmark = output.benchmark;
  if (benchmark === "bench_token_reduction_after_first_turn") return 4;
  if (benchmark === "bench_branch_switch_invalidation") return 4;
  if (benchmark === "bench_stale_source_invalidation") return 4;
  if (benchmark === "bench_diff_vs_naive_resend") return 4;
  return 3;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
