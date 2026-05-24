import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createGitRepoSnapshot } from "../../.tmp/build/src/core/git/index.js";

const now = "2026-05-24T00:00:00.000Z";

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-repo-snapshot-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    writeFileSync(path.join(dir, ".gitignore"), "ignored.env\n");
    mkdirSync(path.join(dir, ".grape"), { recursive: true });
    mkdirSync(path.join(dir, "src"), { recursive: true });
    mkdirSync(path.join(dir, "docs"), { recursive: true });
    writeFileSync(path.join(dir, ".grape", "rules.md"), "Never store raw secrets.\n");
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
    const snapshot = createGitRepoSnapshot({ rootPath: repoPath, repoId: "repo-1", createdAt: now });
    const fileKinds = new Map(snapshot.files.map((file) => [file.path, file.sourceKind]));

    assert.equal(fileKinds.has("ignored.env"), false);
    assert.equal(fileKinds.get(".grape/rules.md"), "rule");
    assert.equal(fileKinds.get("src/calculateDiscount.ts"), "source");
    assert.equal(fileKinds.get("src/calculateDiscount.test.ts"), "test");
    assert.equal(fileKinds.get("package.json"), "package");
    assert.equal(fileKinds.get("docs/README.md"), "doc");
    assert.ok(snapshot.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
  });
});

test("git repo snapshot marks dirty worktree and changes worktree hash", () => {
  withGitRepo((repoPath) => {
    const clean = createGitRepoSnapshot({ rootPath: repoPath, repoId: "repo-1", createdAt: now });

    writeFileSync(path.join(repoPath, "src", "calculateDiscount.ts"), "export const discount = 20;\n");
    writeFileSync(path.join(repoPath, "src", "newFile.ts"), "export const fresh = true;\n");

    const dirty = createGitRepoSnapshot({ rootPath: repoPath, repoId: "repo-1", createdAt: now });

    assert.equal(dirty.worktreeStatus, "dirty");
    assert.deepEqual(dirty.dirtyPaths, ["src/calculateDiscount.ts", "src/newFile.ts"]);
    assert.notEqual(dirty.worktreeHash, clean.worktreeHash);
    assert.notEqual(dirty.snapshotHash, clean.snapshotHash);
  });
});
