import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  classifySourceKind,
  createGitRepoSnapshot,
  maxSnapshotFileBytes
} from "../../../.tmp/build/src/core/git/index.js";

const now = "2026-05-24T00:00:00.000Z";

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-repo-snapshot-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    writeFileSync(path.join(dir, ".gitignore"), "ignored.env\n");
    mkdirSync(path.join(dir, ".grape"), { recursive: true });
    mkdirSync(path.join(dir, ".cursor"), { recursive: true });
    mkdirSync(path.join(dir, "src"), { recursive: true });
    mkdirSync(path.join(dir, "docs"), { recursive: true });
    writeFileSync(path.join(dir, ".grape", "rules.md"), "Never store raw secrets.\n");
    writeFileSync(path.join(dir, ".cursor", "rules"), "Use the repo's local test command.\n");
    writeFileSync(path.join(dir, "src", "calculateDiscount.ts"), "export const discount = 10;\n");
    writeFileSync(path.join(dir, "src", "calculateDiscount.test.ts"), "import './calculateDiscount';\n");
    writeFileSync(path.join(dir, "package.json"), "{\"name\":\"fixture\"}\n");
    writeFileSync(path.join(dir, "docs", "README.md"), "# Fixture\n");
    writeFileSync(path.join(dir, "ignored.env"), "SECRET=value\n");
    execGit(dir, ["add", "."]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "initial fixture"
    ]);

    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function execGit(repoPath, args) {
  return execFileSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

test("git repo snapshot is deterministic for a clean worktree", () => {
  withGitRepo((repoPath) => {
    const first = createGitRepoSnapshot({ rootPath: repoPath, repoId: "repo-1", createdAt: now });
    const second = createGitRepoSnapshot({ rootPath: repoPath, repoId: "repo-1", createdAt: now });

    assert.equal(first.branch, "main");
    assert.match(first.commit, /^[a-f0-9]{40}$/);
    assert.equal(first.worktreeStatus, "clean");
    assert.deepEqual(first.dirtyPaths, []);
    assert.equal(first.snapshotHash, second.snapshotHash);
    assert.equal(first.worktreeHash, second.worktreeHash);
    assert.equal(first.snapshotId, second.snapshotId);
  });
});

test("git repo snapshot excludes ignored files and classifies visible files", () => {
  withGitRepo((repoPath) => {
    writeFileSync(path.join(repoPath, ".aiignore"), "private.txt\n");
    writeFileSync(path.join(repoPath, "private.txt"), "PRIVATE=value\n");
    writeFileSync(path.join(repoPath, "ignored.env"), "SECRET=tracked\n");
    execGit(repoPath, ["add", ".aiignore"]);
    execGit(repoPath, ["add", "-f", "ignored.env", "private.txt"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add ignored fixtures"
    ]);

    const snapshot = createGitRepoSnapshot({ rootPath: repoPath, repoId: "repo-1", createdAt: now });
    const fileKinds = new Map(snapshot.files.map((file) => [file.path, file.sourceKind]));
    const rejected = new Map(snapshot.rejectedFiles.map((file) => [file.path, file]));

    assert.equal(fileKinds.has("ignored.env"), false);
    assert.equal(fileKinds.has("private.txt"), false);
    assert.equal(rejected.get("ignored.env")?.reason, "git_ignored");
    assert.equal(rejected.get("ignored.env")?.privacyStatus, "ignored");
    assert.equal(rejected.get("private.txt")?.reason, "privacy_ignored");
    assert.equal(rejected.get("private.txt")?.privacyStatus, "private");
    assert.equal(fileKinds.get(".grape/rules.md"), "rule");
    assert.equal(fileKinds.get(".cursor/rules"), "rule");
    assert.equal(fileKinds.get("src/calculateDiscount.ts"), "source");
    assert.equal(fileKinds.get("src/calculateDiscount.test.ts"), "test");
    assert.equal(fileKinds.get("package.json"), "package");
    assert.equal(fileKinds.get("docs/README.md"), "doc");
    assert.ok(snapshot.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
  });
});

test("git repo snapshot rejects binary and oversized files before source ingestion", () => {
  withGitRepo((repoPath) => {
    writeFileSync(path.join(repoPath, "src", "binary.ts"), Buffer.from([0, 1, 2, 3]));
    writeFileSync(path.join(repoPath, "src", "large.ts"), Buffer.alloc(maxSnapshotFileBytes + 1, "a"));
    execGit(repoPath, ["add", "src/binary.ts", "src/large.ts"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add non-text fixtures"
    ]);

    const snapshot = createGitRepoSnapshot({ rootPath: repoPath, repoId: "repo-1", createdAt: now });
    const filePaths = new Set(snapshot.files.map((file) => file.path));
    const rejected = new Map(snapshot.rejectedFiles.map((file) => [file.path, file]));

    assert.equal(filePaths.has("src/binary.ts"), false);
    assert.equal(filePaths.has("src/large.ts"), false);
    assert.equal(rejected.get("src/binary.ts")?.reason, "binary");
    assert.equal(rejected.get("src/binary.ts")?.privacyStatus, "allowed");
    assert.equal(rejected.get("src/binary.ts")?.metadata?.sha256?.length, 64);
    assert.equal(rejected.get("src/large.ts")?.reason, "too_large");
    assert.equal(rejected.get("src/large.ts")?.privacyStatus, "allowed");
    assert.equal(rejected.get("src/large.ts")?.metadata?.sizeBytes, maxSnapshotFileBytes + 1);
  });
});

test("git repo snapshot rejects Grape runtime state paths without reading them", () => {
  withGitRepo((repoPath) => {
    mkdirSync(path.join(repoPath, ".grape", "artifacts"), { recursive: true });
    mkdirSync(path.join(repoPath, ".grape", "cache"), { recursive: true });
    writeFileSync(path.join(repoPath, ".grape", "config.json"), '{"private":"local"}\n');
    writeFileSync(path.join(repoPath, ".grape", "grape.db"), "not a real db\n");
    writeFileSync(path.join(repoPath, ".grape", "artifacts", "ctx.json"), '{"clientSecret":"example-secret-value"}\n');
    writeFileSync(path.join(repoPath, ".grape", "cache", "cache.txt"), "cached local state\n");
    execGit(repoPath, [
      "add",
      "-f",
      ".grape/config.json",
      ".grape/grape.db",
      ".grape/artifacts/ctx.json",
      ".grape/cache/cache.txt"
    ]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add grape runtime state"
    ]);

    const snapshot = createGitRepoSnapshot({ rootPath: repoPath, repoId: "repo-1", createdAt: now });
    const filePaths = new Set(snapshot.files.map((file) => file.path));
    const rejected = new Map(snapshot.rejectedFiles.map((file) => [file.path, file]));

    assert.equal(filePaths.has(".grape/rules.md"), true);
    assert.equal(filePaths.has(".grape/config.json"), false);
    assert.equal(filePaths.has(".grape/grape.db"), false);
    assert.equal(filePaths.has(".grape/artifacts/ctx.json"), false);
    assert.equal(filePaths.has(".grape/cache/cache.txt"), false);
    assert.equal(rejected.get(".grape/config.json")?.reason, "grape_runtime");
    assert.equal(rejected.get(".grape/artifacts/ctx.json")?.reason, "grape_runtime");
    assert.equal(rejected.get(".grape/artifacts/ctx.json")?.metadata, undefined);
  });
});

test("source kind classifier recognizes local agent rule files", () => {
  assert.equal(classifySourceKind("AGENTS.md"), "rule");
  assert.equal(classifySourceKind(".cursorrules"), "rule");
  assert.equal(classifySourceKind(".cursor/rules"), "rule");
  assert.equal(classifySourceKind(".cursor/rules/project.md"), "rule");
  assert.equal(classifySourceKind(".aiassistant/rules/team.md"), "rule");
  assert.equal(classifySourceKind(".junie/guidelines.md"), "rule");
  assert.equal(classifySourceKind(".grape/rules.md"), "rule");
});

test("source kind classifier recognizes common package manifests", () => {
  assert.equal(classifySourceKind("package.json"), "package");
  assert.equal(classifySourceKind("packages/api/pyproject.toml"), "package");
  assert.equal(classifySourceKind("services/api/requirements.txt"), "package");
  assert.equal(classifySourceKind("crates/core/Cargo.toml"), "package");
  assert.equal(classifySourceKind("cmd/api/go.mod"), "package");
  assert.equal(classifySourceKind("java/pom.xml"), "package");
  assert.equal(classifySourceKind("apps/web/build.gradle"), "package");
  assert.equal(classifySourceKind("apps/web/settings.gradle.kts"), "package");
});

test("git repo snapshot marks dirty worktree and changes worktree hash", () => {
  withGitRepo((repoPath) => {
    const clean = createGitRepoSnapshot({ rootPath: repoPath, repoId: "repo-1", createdAt: now });

    writeFileSync(path.join(repoPath, "src", "calculateDiscount.ts"), "export const discount = 20;\n");
    writeFileSync(path.join(repoPath, "src", "newFile.ts"), "export const fresh = true;\n");
    writeFileSync(path.join(repoPath, "src", "stagedOnly.ts"), "export const staged = true;\n");
    execGit(repoPath, ["add", "src/stagedOnly.ts"]);

    const dirty = createGitRepoSnapshot({ rootPath: repoPath, repoId: "repo-1", createdAt: now });
    const scopeByPath = new Map(dirty.dirtyPathScopes.map((entry) => [entry.path, entry.sourceScope]));

    assert.equal(dirty.worktreeStatus, "dirty");
    assert.deepEqual(dirty.dirtyPaths, ["src/calculateDiscount.ts", "src/newFile.ts", "src/stagedOnly.ts"]);
    assert.equal(scopeByPath.get("src/calculateDiscount.ts"), "unstaged");
    assert.equal(scopeByPath.get("src/newFile.ts"), "untracked");
    assert.equal(scopeByPath.get("src/stagedOnly.ts"), "staged");
    assert.notEqual(dirty.worktreeHash, clean.worktreeHash);
    assert.notEqual(dirty.snapshotHash, clean.snapshotHash);
  });
});
