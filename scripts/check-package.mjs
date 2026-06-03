import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

assert(packageJson.private !== true, "package.json must not be private for the documented global install path");
assert(packageJson.bin?.grape === "dist/cli/index.js", "package.json bin.grape must point at dist/cli/index.js");
assert(packageJson.engines?.node === ">=22.13.0", "package.json must keep the documented Node runtime floor");

const requiredFiles = [
  "dist/cli/index.js",
  "dist/core/storage/migrations/0001_initial_storage.sql",
  "dist/core/storage/migrations/0002_indexing_foundation.sql",
  "dist/core/storage/migrations/0003_fts_entries.sql",
  "dist/core/storage/migrations/0004_compression_cache.sql",
  "dist/core/storage/migrations/0005_context_performance_indexes.sql"
];

const forbiddenStaleBuildFiles = [
  "dist/core/storage/claim-repositories.js",
  "dist/core/storage/compression-repositories.js",
  "dist/core/storage/evidence-repositories.js",
  "dist/core/storage/fts-repositories.js",
  "dist/core/storage/indexing-repositories.js",
  "dist/core/storage/proof-repositories.js"
];

for (const file of requiredFiles) {
  assert(existsSync(path.join(root, file)), `package build output is missing ${file}`);
}

const npmCacheDir = path.join(root, ".tmp", "npm-cache");
mkdirSync(npmCacheDir, { recursive: true });

const dryRun = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    npm_config_audit: "false",
    npm_config_cache: npmCacheDir,
    npm_config_fund: "false",
    npm_config_update_notifier: "false"
  },
  stdio: ["ignore", "pipe", "pipe"]
});
assert(dryRun.status === 0, `npm pack dry-run failed: ${dryRun.stderr.trim()}`);

const packResult = JSON.parse(dryRun.stdout)[0];
const packedFiles = new Set(packResult.files.map((file) => file.path));

for (const file of ["package.json", "README.md", "CHANGELOG.md", ...requiredFiles]) {
  assert(packedFiles.has(file), `npm package is missing ${file}`);
}

for (const file of forbiddenStaleBuildFiles) {
  assert(!packedFiles.has(file), `npm package includes stale build file ${file}`);
}

for (const file of packedFiles) {
  assert(!file.startsWith("do-not-commit-docs/"), "npm package must not include do-not-commit-docs");
  assert(!file.startsWith(".tmp/"), "npm package must not include .tmp build output");
  assert(!file.startsWith("src/"), "npm package must not include TypeScript source files");
  assert(!file.startsWith("tests/"), "npm package must not include behavior tests");
  assert(!file.startsWith("node_modules/"), "npm package must not include node_modules");
}

console.log(`package ok: ${packResult.filename}`);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
