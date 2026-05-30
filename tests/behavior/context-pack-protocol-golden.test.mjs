import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertInvalidationProtocol,
  assertProtocolPackItems,
  assertSecondTurnOmissionProtocol
} from "./helpers/context-pack-protocol.mjs";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

test("protocol golden: second no-change turn omits safely with restore metadata", () => {
  withGitRepo((repoPath) => {
    const sessionId = "protocol-golden-omit";
    const first = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount tests",
      "--session",
      sessionId
    ]);
    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount tests",
      "--session",
      sessionId
    ]);
    const artifactJson = JSON.parse(readFileSync(second.artifactJsonPath, "utf8"));

    assert.equal(artifactJson.artifactFormat, "grape.context-pack.v1");
    assert.equal(artifactJson.artifactFormatVersion, 1);
    assert.equal(artifactJson.contextPackItemShape, "ContextPackItem");
    assert.equal(second.unsafeReasons.length, 0);

    assertProtocolPackItems(second.contextPackItems, artifactJson.contextArtifact.inputRefs);
    assertSecondTurnOmissionProtocol(second.contextPackItems);
    assert.equal(first.sessionId, second.sessionId);
    assert.equal(second.tokenMetric.unsafeOmissions, 0);
  });
});

test("protocol golden: branch switch emits INVALIDATE_PREVIOUS for prior sent context", () => {
  withGitRepo((repoPath) => {
    const sessionId = "protocol-golden-branch";
    runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount behavior",
      "--session",
      sessionId
    ]);

    execGit(repoPath, ["checkout", "-b", "feature/context"]);
    writeFileSync(
      path.join(repoPath, "README.md"),
      "# Feature branch\n\nBranch-specific protocol golden fixture.\n"
    );
    execGit(repoPath, ["add", "README.md"]);
    gitCommit(repoPath, "feature branch");

    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount behavior",
      "--session",
      sessionId
    ]);
    const artifactJson = JSON.parse(readFileSync(second.artifactJsonPath, "utf8"));

    assertProtocolPackItems(second.contextPackItems, artifactJson.contextArtifact.inputRefs);
    assertInvalidationProtocol(second.contextPackItems);
    assert.equal(second.branch, "feature/context");
    assert.equal(second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), false);
  });
});

test("protocol golden: edited source invalidates prior sent context", () => {
  withGitRepo((repoPath) => {
    const sessionId = "protocol-golden-stale";
    runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount behavior",
      "--session",
      sessionId
    ]);

    const sourcePath = path.join(repoPath, "src", "app.ts");
    writeFileSync(
      sourcePath,
      "export function startApp() {\n  return 'protocol-golden-stale';\n}\n"
    );

    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain calculateDiscount behavior",
      "--session",
      sessionId
    ]);
    const artifactJson = JSON.parse(readFileSync(second.artifactJsonPath, "utf8"));

    assertProtocolPackItems(second.contextPackItems, artifactJson.contextArtifact.inputRefs);
    assertInvalidationProtocol(second.contextPackItems);
  });
});

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-protocol-golden-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, "README.md"), "# Protocol golden\n");
    writeFileSync(path.join(dir, "AGENTS.md"), "Prefer exact source evidence.\n");
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "protocol-golden", type: "module" }, null, 2));
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
