import { readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./environment.mjs";

export function loadManifest(root = repoRoot()) {
  const manifestPath = path.join(root, "benchmarks/fixtures/manifest.json");
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

export function fixtureSourcePath(fixtureName, root = repoRoot()) {
  return path.join(root, "tests/fixtures", fixtureName);
}

export function readFixtureMetadata(fixtureName, root = repoRoot()) {
  const metadataPath = path.join(fixtureSourcePath(fixtureName, root), "grape-fixture.json");
  return JSON.parse(readFileSync(metadataPath, "utf8"));
}

export function grapeBenchFixtures(root = repoRoot()) {
  return [
    "clean-typescript-app",
    "branch-switch-typescript-app",
    "stale-source-typescript-app",
    "session-reset-typescript-app",
    "polyglot-fallback-repo",
    "monorepo-lite-repo"
  ];
}

export const TASK_PROMPTS = [
  "Find the source of this failing test and propose the smallest fix.",
  "Explain how this CLI command reaches the session ledger.",
  "Find the code path responsible for stale context invalidation.",
  "Identify whether this source excerpt is still current after the branch change.",
  "Summarize the package root and workspace scope for this task."
];
