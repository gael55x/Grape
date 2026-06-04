import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-cli-fallback-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    writeFileSync(path.join(dir, "README.md"), "# Fixture\n");
    writeFileSync(path.join(dir, "app.ts"), "export const value = 1;\n");
    execGit(dir, ["add", "README.md", "app.ts"]);
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

function runCli(repoPath, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoPath,
    encoding: "utf8"
  });
}

function runCliJson(repoPath, args) {
  const result = runCli(repoPath, [...args, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function localPublicPath(repoPath, value) {
  assert.equal(typeof value, "string");
  return value.replace(/^<repo-root>/, repoPath);
}

test("cli sync refreshes local snapshot evidence and index state", () => {
  withGitRepo((repoPath) => {
    const sync = runCliJson(repoPath, ["sync"]);

    assert.equal(sync.branch, "main");
    assert.equal(sync.dirtyWorktree, false);
    assert.equal(sync.scan.rejectedFileCount, 0);
    assert.equal(typeof sync.snapshotId, "string");
    assert.equal(sync.snapshotId.length > 0, true);
    assert.equal(typeof sync.worktreeStateId, "string");
    assert.equal(sync.worktreeStateId.length > 0, true);
    assert.equal(existsSync(path.join(repoPath, ".grape", "config.json")), true);
    assert.equal(existsSync(path.join(repoPath, ".grape", "grape.db")), true);

    const status = runCliJson(repoPath, ["status"]);
    assert.equal(status.initialized, true);
    assert.deepEqual(status.pendingMigrations, []);
  });
});

test("cli diff-context compiles a session-scoped context diff", () => {
  withGitRepo((repoPath) => {
    const first = runCliJson(repoPath, [
      "diff-context",
      "--task",
      "inspect app value",
      "--session",
      "fallback-session"
    ]);
    const second = runCliJson(repoPath, [
      "diff-context",
      "--task",
      "inspect app value",
      "--session",
      "fallback-session"
    ]);

    assert.equal(first.sessionId, "fallback-session");
    assert.equal(first.contextPackItems.some((item) => item.state === "NEW" || item.state === "PINNED"), true);
    assert.equal(second.sessionId, "fallback-session");
    assert.equal(second.omittedItemCount > 0, true);
    assert.equal(second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), true);
    assert.equal(existsSync(localPublicPath(repoPath, first.artifactJsonPath)), true);
    assert.equal(existsSync(localPublicPath(repoPath, first.artifactMarkdownPath)), true);
  });
});
