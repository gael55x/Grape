import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { assertInvalidationProtocol, assertProtocolPackItems } from "../helpers/context-pack-protocol.mjs";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

test("transport: edited relevant source invalidates instead of unsafe OMIT_UNCHANGED", () => {
  withGitRepo((repoPath) => {
    const sessionId = "transport-edit";
    runCliJson(repoPath, ["compile", "--task", "Explain calculateDiscount behavior", "--session", sessionId]);
    writeFileSync(
      path.join(repoPath, "src", "app.ts"),
      "export function startApp() {\n  return 'edited-for-transport';\n}\n"
    );
    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount behavior",
      "--session",
      sessionId
    ]);
    assert.equal(second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), false);
    assert.ok(
      second.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS" || item.state === "CHANGED"),
      "edited relevant source should invalidate or resend as CHANGED"
    );
  });
});

test("transport: dirty relevant file does not unsafe-omit stale content", () => {
  withGitRepo((repoPath) => {
    const sessionId = "transport-dirty-relevant";
    runCliJson(repoPath, ["compile", "--task", "Explain calculateDiscount behavior", "--session", sessionId]);
    writeFileSync(
      path.join(repoPath, "src", "app.ts"),
      "export function startApp() {\n  return 'dirty-uncommitted';\n}\n"
    );
    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount behavior",
      "--session",
      sessionId
    ]);
    assert.equal(second.dirtyWorktree, true);
    assert.equal(second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), false);
    assert.ok(
      second.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS" || item.state === "CHANGED")
    );
  });
});

test("transport: dirty unrelated file uses conservative transport without unsafe omissions", () => {
  withGitRepo((repoPath) => {
    const sessionId = "transport-dirty-unrelated";
    runCliJson(repoPath, ["compile", "--task", "Explain calculateDiscount behavior", "--session", sessionId]);
    writeFileSync(path.join(repoPath, "scratch-notes.txt"), "unrelated dirty notes\n");
    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount behavior",
      "--session",
      sessionId
    ]);
    assert.equal(second.dirtyWorktree, true);
    assert.equal(second.tokenMetric.unsafeOmissions, 0);
    assert.ok(second.contextPackItems.length > 0);
    assert.equal(
      second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"),
      false,
      "current policy conservatively avoids OMIT_UNCHANGED when the worktree is dirty"
    );
  });
});

test("transport: deleted relevant file invalidates prior sent context", () => {
  withGitRepo((repoPath) => {
    const sessionId = "transport-delete";
    runCliJson(repoPath, ["compile", "--task", "Explain calculateDiscount behavior", "--session", sessionId]);
    unlinkSync(path.join(repoPath, "src", "app.ts"));
    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount behavior",
      "--session",
      sessionId
    ]);
    assertInvalidationProtocol(second.contextPackItems);
    assert.equal(second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), false);
  });
});

test("transport: renamed relevant file invalidates old path context", () => {
  withGitRepo((repoPath) => {
    const sessionId = "transport-rename";
    runCliJson(repoPath, ["compile", "--task", "Explain calculateDiscount behavior", "--session", sessionId]);
    renameSync(path.join(repoPath, "src", "app.ts"), path.join(repoPath, "src", "application.ts"));
    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount behavior",
      "--session",
      sessionId
    ]);
    assertInvalidationProtocol(second.contextPackItems);
    assert.equal(second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), false);
  });
});

test("transport: branch switch emits explicit invalidation", () => {
  withGitRepo((repoPath) => {
    const sessionId = "transport-branch";
    runCliJson(repoPath, ["compile", "--task", "Explain calculateDiscount behavior", "--session", sessionId]);
    execGit(repoPath, ["checkout", "-b", "feature/transport"]);
    writeFileSync(path.join(repoPath, "README.md"), "# Feature branch transport\n");
    execGit(repoPath, ["add", "README.md"]);
    gitCommit(repoPath, "branch content");
    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount behavior",
      "--session",
      sessionId
    ]);
    const artifactJson = JSON.parse(readFileSync(localPublicPath(repoPath, second.artifactJsonPath), "utf8"));
    assertProtocolPackItems(second.contextPackItems, artifactJson.contextArtifact.inputRefs);
    assertInvalidationProtocol(second.contextPackItems);
  });
});

test("transport: dependency manifest change triggers invalidation", () => {
  withGitRepo((repoPath) => {
    const sessionId = "transport-manifest";
    runCliJson(repoPath, ["compile", "--task", "Explain calculateDiscount behavior", "--session", sessionId]);
    const packagePath = path.join(repoPath, "package.json");
    const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
    pkg.dependencies = { lodash: "4.17.21" };
    writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount behavior",
      "--session",
      sessionId
    ]);
    assertInvalidationProtocol(second.contextPackItems);
    assert.equal(second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), false);
  });
});

test("transport: diff-context --explain returns per-item reasons without bodies", () => {
  withGitRepo((repoPath) => {
    const sessionId = "transport-explain";
    runCliJson(repoPath, ["diff-context", "--task", "Explain calculateDiscount behavior", "--session", sessionId]);
    const second = runCliJson(repoPath, [
      "diff-context",
      "--task",
      "Explain calculateDiscount behavior",
      "--session",
      sessionId,
      "--explain"
    ]);
    assert.ok(Array.isArray(second.packExplain));
    assert.ok(second.packExplain.length > 0);
    for (const row of second.packExplain) {
      assert.equal(typeof row.itemId, "string");
      assert.equal(typeof row.diffState, "string");
      assert.equal(row.sessionId, sessionId);
      assert.equal(typeof row.reason, "string");
      assert.equal("body" in row, false);
      assert.equal("content" in row, false);
    }
  });
});

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-transport-coverage-"));
  try {
    execGit(dir, ["init", "-b", "main"]);
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, "README.md"), "# Transport coverage\n");
    writeFileSync(path.join(dir, "AGENTS.md"), "Prefer exact source evidence.\n");
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "transport-coverage", type: "module" }, null, 2));
    writeFileSync(path.join(dir, "src", "app.ts"), "export function startApp() {\n  return 'ready';\n}\n");
    execGit(dir, ["add", "."]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "initial"
    ]);
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runCliJson(repoPath, args) {
  const result = spawnSync(process.execPath, [cliPath, ...args, "--json"], {
    cwd: repoPath,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function localPublicPath(repoPath, value) {
  return value.replace(/^<repo-root>/, repoPath);
}

function execGit(repoPath, args) {
  execFileSync("git", ["-C", repoPath, ...args], { stdio: "ignore" });
}

function gitCommit(repoPath, message) {
  execGit(repoPath, [
    "-c",
    "user.name=Grape Test",
    "-c",
    "user.email=grape@example.test",
    "commit",
    "-m",
    message
  ]);
}
