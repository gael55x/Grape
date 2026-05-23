import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const fixtureDir = join(root, "tests", "fixtures", "clean-typescript-app");
const metadata = JSON.parse(readFileSync(join(fixtureDir, "grape-fixture.json"), "utf8"));

const errors = [];

function hashWorktree(files) {
  const stableInput = files
    .map((file) => `${file.path}:${file.sha256}`)
    .sort()
    .join("\n");

  return createHash("sha256").update(stableInput).digest("hex");
}

const snapshot = {
  snapshotId: `${metadata.name}:main:fixture-static`,
  repoId: metadata.name,
  rootPath: "tests/fixtures/clean-typescript-app",
  branch: "main",
  commit: "fixture-static",
  worktreeStatus: metadata.repoShape?.worktree,
  worktreeHash: hashWorktree(metadata.files ?? []),
  files: metadata.files ?? [],
  hashAlgorithm: "sha256",
  createdAt: "fixture"
};

for (const field of [
  "snapshotId",
  "repoId",
  "rootPath",
  "branch",
  "commit",
  "worktreeStatus",
  "worktreeHash",
  "files",
  "hashAlgorithm",
  "createdAt"
]) {
  if (snapshot[field] === undefined || snapshot[field] === "") {
    errors.push(`snapshot missing field: ${field}`);
  }
}

if (snapshot.worktreeStatus !== "clean") {
  errors.push("clean-typescript-app snapshot must be clean");
}

if (snapshot.hashAlgorithm !== "sha256") {
  errors.push("snapshot hash algorithm must be sha256");
}

if (snapshot.files.length < 4) {
  errors.push("snapshot must include source, test, rule, and package files");
}

if (!/^[a-f0-9]{64}$/.test(snapshot.worktreeHash)) {
  errors.push("worktreeHash must be a sha256 hex digest");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("alpha snapshot ok");
