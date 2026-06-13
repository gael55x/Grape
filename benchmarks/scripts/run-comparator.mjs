import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { captureEnvironment, repoRoot } from "./lib/environment.mjs";
import { readFixtureMetadata } from "./lib/fixtures.mjs";
import { estimateTokens } from "./lib/tokens.mjs";

const root = repoRoot();
const resultsDir = path.join(root, "benchmarks/results");
mkdirSync(resultsDir, { recursive: true });

const only = process.argv.find((arg) => arg.startsWith("--tool="))?.split("=")[1];
const fixtureName = "clean-typescript-app";
const metadata = readFixtureMetadata(fixtureName);
const fixturePath = path.join(root, "tests/fixtures", fixtureName);
const task = metadata.benchmarkTask;

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const report = {
  runId,
  environment: captureEnvironment(),
  fixture: fixtureName,
  task,
  comparators: []
};

function record(tool, entry) {
  report.comparators.push({ tool, ...entry });
}

function commandExists(command) {
  try {
    execFileSync(command, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function runGraphify() {
  if (only && only !== "graphify") return;
  if (!commandExists("graphify")) {
    record("graphify", {
      benchmarkDecision: "benchmark partially",
      status: "skipped",
      reason: "graphify CLI not installed (pip install graphifyy or uv tool install graphifyy)"
    });
    return;
  }

  const outDir = path.join(fixturePath, "graphify-out");
  const started = Date.now();
  const update = spawnSync("graphify", ["update", fixturePath], {
    encoding: "utf8",
    timeout: 300000,
    cwd: root
  });
  const indexMs = Date.now() - started;

  if (update.status !== 0) {
    record("graphify", {
      benchmarkDecision: "benchmark partially",
      status: "fail",
      setupMinutes: indexMs / 60000,
      compileOrIndexMs: indexMs,
      detail: update.stderr.trim() || update.stdout.trim()
    });
    return;
  }

  const graphPath = path.join(outDir, "graph.json");
  const queryStarted = Date.now();
  const query = spawnSync(
    "graphify",
    ["query", task, "--graph", graphPath, "--budget", "2000"],
    { encoding: "utf8", timeout: 120000 }
  );
  const retrievalMs = Date.now() - queryStarted;
  const payload = query.stdout.trim();
  const artifactBytes = existsSync(graphPath) ? readFileSync(graphPath).length : 0;

  record("graphify", {
    benchmarkDecision: "benchmark partially",
    status: query.status === 0 ? "pass" : "fail",
    setupMinutes: indexMs / 60000,
    compileOrIndexMs: indexMs,
    retrievalMs,
    artifactBytes,
    payloadBytes: Buffer.byteLength(payload, "utf8"),
    estimatedTokens: estimateTokens(payload),
    comparisonClass: "orientation",
    notApplicable: ["session_diff_transport", "restore_semantics", "proof_backed_claims", "mcp_grape_get_context"],
    humanUsefulnessScore: payload.length > 100 ? 3 : 1,
    detail: query.status !== 0 ? query.stderr.trim() : undefined
  });
}

function skipComparator(tool, reason, decision = "capability matrix only") {
  if (only && only !== tool) return;
  record(tool, { benchmarkDecision: decision, status: "skipped", reason });
}

skipComparator(
  "chum-mem",
  "Requires Docker Compose stack (Postgres, Chroma, worker). GPL-3.0. See benchmarks/comparators/chum-mem.md.",
  "benchmark partially"
);
skipComparator(
  "agentmemory",
  "Requires npm install @agentmemory/agentmemory and running memory server. See benchmarks/comparators/agentmemory.md.",
  "benchmark partially"
);
skipComparator("graphiti", "Requires graph DB + LLM API key. Not coding-agent context transport.", "capability matrix only");
skipComparator("mem0", "Requires vector store and often cloud/LLM keys.", "capability matrix only");
skipComparator("cognee", "Requires cognify pipeline + LLM API key.", "capability matrix only");
skipComparator("zep", "Primary path is Zep Cloud SDK.", "capability matrix only");
skipComparator("letta", "Agent platform memory, not repo context compiler.", "benchmark partially");
skipComparator("langchain-memory", "Framework primitive, not installable product.", "exclude");
skipComparator("llamaindex-memory", "Framework module, not installable product.", "exclude");

runGraphify();

const outPath = path.join(resultsDir, `comparators-${runId}.json`);
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log("Comparator benchmark run\n");
for (const row of report.comparators) {
  console.log(`- ${row.tool}: ${row.status}${row.reason ? ` (${row.reason})` : ""}`);
}
console.log(`\nWrote ${path.relative(root, outPath)}`);
