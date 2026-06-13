import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { repoRoot } from "./lib/environment.mjs";

const root = repoRoot();
const resultsDir = path.join(root, "benchmarks/results");
const files = readdirSync(resultsDir)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .reverse();

if (files.length === 0) {
  console.error("No benchmark result JSON files found in benchmarks/results/");
  process.exit(1);
}

const latestRun = files.find((name) => name.startsWith("run-"));
const latestPostBeta = files.find((name) => name.startsWith("post-beta-") && name.endsWith("-published-beta.json"));
const latestComparators = files.find((name) => name.startsWith("comparators-"));
const lines = [
  "# Benchmark Results Summary",
  "",
  "> **Fixture evidence only. Not production performance evidence or external superiority proof. Regenerate with `npm run bench:summary`.**",
  ""
];

const primaryTarget = "grape-beta-candidate-tarball";

if (latestRun) {
  const run = JSON.parse(readFileSync(path.join(resultsDir, latestRun), "utf8"));
  lines.push(`## Latest Grape run (\`${latestRun}\`)`, "");
  lines.push(`- Primary target: \`${run.environment.primaryTarget ?? primaryTarget}\``);
  lines.push(`- Git: \`${run.environment.gitCommit}\``);
  lines.push(`- Tarball: \`${run.environment.grapeTarball ?? "n/a"}\``);
  lines.push(`- package.json version: \`${run.environment.packageJsonVersion ?? run.environment.grapePackageVersion}\``);
  lines.push(`- Published npm (reference): \`${run.environment.publishedNpmVersion ?? "n/a"}\``);
  lines.push(`- Node: \`${run.environment.nodeVersion}\` on \`${run.environment.platform}\``);
  if (run.environment.betaCandidateNote) {
    lines.push(`- Note: ${run.environment.betaCandidateNote}`);
  }
  lines.push("");

  const fixtureRows =
    run.phases?.grapeFixtures?.fixtures ??
    run.scenarios?.filter((row) => row.target === primaryTarget) ??
    run.scenarios ??
    [];

  if (fixtureRows.length > 0) {
    lines.push("| Scenario | Target | Result | Turn1 | Turn2 | Omission % | Stale | Usefulness |");
    lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |");
    for (const row of fixtureRows) {
      lines.push(
        `| ${row.scenario} | ${row.target ?? primaryTarget} | ${row.result} | ${row.toolPayloadTokensTurn1 ?? "n/a"} | ${row.toolPayloadTokensTurn2 ?? "n/a"} | ${row.omissionRatio ?? "n/a"} | ${row.staleContextIncidents ?? 0} | ${row.humanUsefulnessScore ?? "n/a"} |`
      );
    }
    lines.push("");
  }

  if (run.summary?.baselines) {
    const b = run.summary.baselines;
    lines.push("## Baselines (`clean-typescript-app`)", "");
    lines.push(`- Naive full context: ${b.naiveFullContextTokens} est. tokens`);
    lines.push(`- Manual rg: ${b.manualRgTokens ?? "n/a"} est. tokens`);
    lines.push(`- Grape turn 1: ${b.grapeTurn1Tokens ?? "n/a"}`);
    lines.push(`- Grape turn 2: ${b.grapeTurn2Tokens ?? "n/a"} (${b.grapeTurn2OmissionRatio ?? "n/a"}% omission vs naive)`);
    lines.push("");
  }
}

if (latestPostBeta) {
  const postBeta = JSON.parse(readFileSync(path.join(resultsDir, latestPostBeta), "utf8"));
  lines.push(`## Latest Published Beta Baseline (\`${latestPostBeta}\`)`, "");
  lines.push(`- Artifact: \`${postBeta.environment.artifactIdentity ?? "n/a"}\``);
  lines.push(`- Package version: \`${postBeta.environment.testedPackageVersion ?? "n/a"}\``);
  lines.push(`- Search baseline: \`${postBeta.searchBaselineStatus ?? postBeta.environment.searchEngine ?? "n/a"}\``);
  lines.push(`- Complete: \`${postBeta.benchmarkComplete ? "yes" : "no"}\``);
  lines.push("");
  lines.push("| Case | Mode | Naive recall/noise | Search recall/noise | Grape final recall/noise | Size vs naive |");
  lines.push("| --- | --- | ---: | ---: | ---: | --- |");
  for (const caseResult of postBeta.cases ?? []) {
    for (const budgetMode of ["uncapped", "budgeted"]) {
      const metrics = caseResult.comparisonMetrics?.[budgetMode];
      const grapeRow = (caseResult.rows ?? []).find(
        (row) => row.baselineName === "grape" && row.budgetMode === budgetMode
      );
      const finalLayer = grapeRow?.layers?.finalAgentFacingRefs;
      const sizeReduction = metrics?.contextSizeReductionVsNaive;
      const sizeText =
        typeof sizeReduction === "number" && sizeReduction < 0
          ? "larger than naive"
          : typeof sizeReduction === "number"
            ? `${Math.round(sizeReduction * 100)}% smaller`
            : "n/a";
      lines.push(
        `| ${caseResult.caseId} | ${budgetMode} | ${formatPair(metrics?.relevanceRecall?.naive, metrics?.knownNoiseRatio?.naive)} | ${formatPair(metrics?.relevanceRecall?.search, metrics?.knownNoiseRatio?.search)} | ${formatPair(finalLayer?.relevanceRecall, finalLayer?.knownNoiseRatio)} | ${sizeText} |`
      );
    }
  }
  lines.push("");
}

if (latestComparators) {
  const comp = JSON.parse(readFileSync(path.join(resultsDir, latestComparators), "utf8"));
  lines.push(`## Comparators (\`${latestComparators}\`)`, "");
  lines.push("| Tool | Status | Index ms | Retrieval ms | Payload tokens | Class |");
  lines.push("| --- | --- | ---: | ---: | ---: | --- |");
  for (const row of comp.comparators) {
    lines.push(
      `| ${row.tool} | ${row.status} | ${row.compileOrIndexMs ?? "n/a"} | ${row.retrievalMs ?? "n/a"} | ${row.estimatedTokens ?? "n/a"} | ${row.comparisonClass ?? row.benchmarkDecision ?? "n/a"} |`
    );
  }
  lines.push("");
}

const outPath = path.join(resultsDir, "latest-summary.md");
writeFileSync(outPath, `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
console.log(`\nWrote ${path.relative(root, outPath)}`);

function formatPair(recall, noise) {
  return `${formatNumber(recall)} / ${formatNumber(noise)}`;
}

function formatNumber(value) {
  if (typeof value !== "number") return "n/a";
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}
