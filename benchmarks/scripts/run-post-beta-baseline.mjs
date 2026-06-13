import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  attributeComponents,
  buildBaselineRow,
  caseBudgetBytes,
  loadPostBetaManifest,
  prepareCaseRepo,
  runGrapeBaseline,
  runNaiveBaseline,
  runSearchBaseline
} from "./lib/baselines.mjs";
import { captureEnvironment, readPackageJson, repoRoot } from "./lib/environment.mjs";
import { installLocalCandidate } from "./lib/local-pack-install.mjs";
import { installPublishedBeta } from "./lib/npm-registry-install.mjs";
import { sanitizeReportText } from "./lib/sanitize-paths.mjs";

const root = repoRoot();
const resultsDir = path.join(root, "benchmarks/results");
const BUDGET_MODES = ["uncapped", "budgeted"];

function parseArgs(argv) {
  const artifact = readFlagValue(argv, "--artifact") ?? "published-beta";
  if (artifact !== "published-beta" && artifact !== "local-candidate") {
    throw new Error(`Unsupported --artifact value: ${artifact}`);
  }
  return { artifact };
}

function readFlagValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  return argv[index + 1];
}

async function main() {
  const { artifact } = parseArgs(process.argv.slice(2));
  const manifest = loadPostBetaManifest(root);
  const pkg = readPackageJson(root);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(resultsDir, { recursive: true });

  let install = null;
  const caseResults = [];
  const allRows = [];

  try {
    install = artifact === "published-beta" ? installPublishedBeta({ root }) : installLocalCandidate({ root });

    for (const caseDef of manifest.cases) {
      const prepared = prepareCaseRepo(caseDef, root);
      const budgetBytes = caseBudgetBytes(manifest, caseDef);
      const rows = [];

      try {
        for (const budgetMode of BUDGET_MODES) {
          const naiveStarted = Date.now();
          let naivePayload;
          let naiveError = null;
          try {
            naivePayload = runNaiveBaseline(prepared.repoPath, budgetMode, budgetBytes);
          } catch (error) {
            naiveError = error;
            naivePayload = { files: [], contextBytes: 0, estimatedTokens: 0 };
          }
          rows.push(
            buildBaselineRow({
              caseDef,
              baselineName: "naive",
              inputSource: "fixture-or-docs-slice",
              packageVersion: install.installedVersion,
              budgetMode,
              budgetBytes,
              payload: naivePayload,
              runtimeMs: Date.now() - naiveStarted,
              errorCount: naiveError ? 1 : 0,
              notes: naiveError ? [sanitizeReportText(naiveError.message, root)] : []
            })
          );

          const searchStarted = Date.now();
          let searchPayload;
          let searchError = null;
          try {
            searchPayload = runSearchBaseline(prepared.repoPath, caseDef, budgetMode, budgetBytes);
          } catch (error) {
            searchError = error;
            searchPayload = { files: [], contextBytes: 0, estimatedTokens: 0 };
          }
          rows.push(
            buildBaselineRow({
              caseDef,
              baselineName: "search",
              inputSource: "rg-manifest-queries",
              packageVersion: install.installedVersion,
              budgetMode,
              budgetBytes,
              payload: searchPayload,
              runtimeMs: Date.now() - searchStarted,
              errorCount: searchError ? 1 : 0,
              notes: searchError ? [sanitizeReportText(searchError.message, root)] : []
            })
          );

          const grapeStarted = Date.now();
          let grapePayload;
          let grapeError = null;
          try {
            grapePayload = runGrapeBaseline({
              grapeCli: install.grapeCli,
              repoPath: prepared.repoPath,
              caseDef,
              budgetMode,
              budgetBytes,
              root
            });
          } catch (error) {
            grapeError = error;
            grapePayload = {
              files: [],
              contextBytes: 0,
              estimatedTokens: 0,
              actualSpanHits: [],
              proofOrEvidencePresent: false,
              taskRetrievalSectionPresent: false
            };
          }
          rows.push(
            buildBaselineRow({
              caseDef,
              baselineName: "grape",
              inputSource: artifact === "published-beta" ? "npm-registry-installed-cli" : "local-pack-installed-cli",
              packageVersion: install.installedVersion,
              budgetMode,
              budgetBytes,
              payload: grapePayload,
              runtimeMs: Date.now() - grapeStarted,
              errorCount: grapeError ? 1 : 0,
              notes: grapeError ? [sanitizeReportText(grapeError.message, root)] : [],
              extra: {
                expectedSpans: grapePayload.expectedSpans,
                actualSpanHits: grapePayload.actualSpanHits,
                proofOrEvidencePresent: grapePayload.proofOrEvidencePresent,
                taskRetrievalSectionPresent: grapePayload.taskRetrievalSectionPresent
              }
            })
          );
        }
      } finally {
        prepared.cleanup();
      }

      const comparisonMetrics = {};
      for (const budgetMode of BUDGET_MODES) {
        const naiveRow = rows.find((row) => row.baselineName === "naive" && row.budgetMode === budgetMode);
        const grapeRow = rows.find((row) => row.baselineName === "grape" && row.budgetMode === budgetMode);
        comparisonMetrics[budgetMode] = {
          relevanceRecall: {
            naive: naiveRow?.relevanceRecall ?? null,
            search: rows.find((row) => row.baselineName === "search" && row.budgetMode === budgetMode)?.relevanceRecall ?? null,
            grape: grapeRow?.relevanceRecall ?? null
          },
          knownNoiseRatio: {
            naive: naiveRow?.knownNoiseRatio ?? null,
            search: rows.find((row) => row.baselineName === "search" && row.budgetMode === budgetMode)?.knownNoiseRatio ?? null,
            grape: grapeRow?.knownNoiseRatio ?? null
          },
          contextSizeReductionVsNaive:
            naiveRow?.contextBytes > 0 && grapeRow
              ? 1 - grapeRow.contextBytes / naiveRow.contextBytes
              : null
        };
      }

      caseResults.push({
        caseId: caseDef.id,
        caseName: caseDef.name,
        rows,
        comparisonMetrics
      });
      allRows.push(...rows);
    }
  } finally {
    install?.cleanup();
  }

  const report = {
    runId,
    capturedAt: new Date().toISOString(),
    environment: {
      ...captureEnvironment(root),
      artifactMode: install.artifactMode,
      artifactIdentity: install.artifactIdentity,
      testedPackageName: pkg.name,
      testedPackageVersion: install.installedVersion,
      ...(install.distTag ? { testedNpmDistTag: install.distTag } : {}),
      ...(install.testedGitCommit ? { testedGitCommit: install.testedGitCommit } : {}),
      installSource: install.installSource,
      installCommand: install.installCommand,
      installPathKind: "mktemp-consumer-workspace",
      installPathSanitized: true,
      installPathBasename: install.installPathBasename
    },
    budgetInterpretation: {
      uncapped: "Uncapped measures maximum recall.",
      budgeted: "Budgeted measures context selection quality under equal context pressure."
    },
    cases: caseResults,
    comparisonMetrics: Object.fromEntries(
      caseResults.map((entry) => [entry.caseId, entry.comparisonMetrics])
    ),
    componentAttribution: attributeComponents(allRows),
    interpretation:
      artifact === "published-beta"
        ? "First post-beta benchmark comparing the published npm package with naive and search baselines across retrieval, bug-fix, and documentation tasks. Results are directional until repeated across more tasks."
        : "Local candidate benchmark from packed git tree. Compare only against published-beta results with different artifactIdentity.",
    limitations: [
      "Small sample: three cases on one machine.",
      "Directional fixture results only; not official release benchmarks.",
      "File-level recall is primary; span checks are supplementary.",
      "Docs case uses a curated docs slice, not the full Grape repository tree."
    ]
  };

  const suffix = artifact === "published-beta" ? "published-beta" : "local-candidate";
  const reportPath = path.join(resultsDir, `post-beta-${runId}-${suffix}.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${path.relative(root, reportPath)}`);
  console.log(`artifactMode=${report.environment.artifactMode}`);
  console.log(`artifactIdentity=${report.environment.artifactIdentity}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
