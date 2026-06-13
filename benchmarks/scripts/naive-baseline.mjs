import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { captureEnvironment, repoRoot } from "./lib/environment.mjs";
import { readFixtureMetadata } from "./lib/fixtures.mjs";
import { estimateTokens } from "./lib/tokens.mjs";

const root = repoRoot();
const fixtureName = process.argv[2] ?? "clean-typescript-app";
const resultsDir = path.join(root, "benchmarks/results");
mkdirSync(resultsDir, { recursive: true });

const metadata = readFixtureMetadata(fixtureName);
const fixturePath = path.join(root, "tests/fixtures", fixtureName);
const files = metadata.files.map((entry) => path.join(fixturePath, entry.path));
const fullText = files
  .filter((filePath) => existsSync(filePath))
  .map((filePath) => readFileSync(filePath, "utf8"))
  .join("\n");

let rgFiles = [];
let rgText = "";
try {
  rgFiles = execFileSync("rg", ["-l", metadata.benchmarkTask.split(/\s+/).slice(0, 2).join("|"), fixturePath], {
    encoding: "utf8"
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  rgText = rgFiles.map((filePath) => readFileSync(filePath, "utf8")).join("\n");
} catch {
  rgText = "";
}

const result = {
  capturedAt: new Date().toISOString(),
  environment: captureEnvironment(),
  fixture: fixtureName,
  task: metadata.benchmarkTask,
  naive: {
    filesIncluded: files.length,
    estimatedTokens: estimateTokens(fullText),
    payloadBytes: Buffer.byteLength(fullText, "utf8")
  },
  manualRg: {
    filesIncluded: rgFiles.length,
    estimatedTokens: estimateTokens(rgText),
    payloadBytes: Buffer.byteLength(rgText, "utf8")
  },
  notes: [
    "Naive baseline resends all fixture metadata files every turn with no omission or invalidation.",
    "Manual rg baseline uses keyword search only; no session ledger or stale-context rejection."
  ]
};

const outPath = path.join(resultsDir, `naive-baseline-${fixtureName}.json`);
writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
