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
    const artifactJson = JSON.parse(readFileSync(localPublicPath(repoPath, second.artifactJsonPath), "utf8"));

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

test("protocol golden: RESTORE_AVAILABLE restores only for the matching session", () => {
  withGitRepo((repoPath) => {
    const sessionId = "protocol-golden-restore";
    runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain restore metadata for protocol context",
      "--session",
      sessionId
    ]);
    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain restore metadata for protocol context",
      "--session",
      sessionId
    ]);
    const artifactJson = JSON.parse(readFileSync(localPublicPath(repoPath, second.artifactJsonPath), "utf8"));

    assertProtocolPackItems(second.contextPackItems, artifactJson.contextArtifact.inputRefs);
    const restorable = second.contextPackItems.find((item) => item.state === "RESTORE_AVAILABLE");
    assert.ok(restorable, "second turn should include RESTORE_AVAILABLE");
    assert.equal(typeof restorable.restoreId, "string");
    assert.ok(restorable.restoreId.length > 0);
    assert.equal(restorable.content.includes(repoPath), false);

    const restored = runCliJson(repoPath, [
      "omitted",
      "--session",
      sessionId,
      "--token",
      restorable.restoreId
    ]);
    assert.equal(restored.status, "restored");
    assert.equal(restored.sessionId, sessionId);
    assert.equal(restored.restoreToken, restorable.restoreId);
    assert.equal(restored.artifactId, second.artifactId);
    assert.equal(restored.sectionId, restorable.sectionId);
    assert.equal(restored.contentHash, restorable.contentHash);
    assert.equal(typeof restored.title, "string");
    assert.ok(restored.title.length > 0);
    assert.equal(typeof restored.body, "string");
    assert.match(restored.body, /Task type/);
    assert.equal(restored.body.includes(repoPath), false);

    const wrongSession = runCli(repoPath, [
      "omitted",
      "--session",
      "protocol-golden-other-session",
      "--token",
      restorable.restoreId,
      "--json"
    ]);
    assert.notEqual(wrongSession.status, 0);
    assert.match(wrongSession.stderr, /not found|stale|session/i);

    const mcpRestored = runMcpTool(repoPath, "grape_get_omitted_item", {
      sessionId,
      restoreToken: restorable.restoreId
    });
    assert.equal(mcpRestored.isError, false);
    assert.equal(mcpRestored.structuredContent.status, "restored");
    assert.equal(Object.hasOwn(mcpRestored.structuredContent, "rootPath"), false);
    assert.equal(mcpRestored.content[0].text.includes(repoPath), false);
    assert.equal(mcpRestored.structuredContent.body.includes(repoPath), false);
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
    const artifactJson = JSON.parse(readFileSync(localPublicPath(repoPath, second.artifactJsonPath), "utf8"));

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
    const artifactJson = JSON.parse(readFileSync(localPublicPath(repoPath, second.artifactJsonPath), "utf8"));

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
  const result = runCli(repoPath, [...args, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function localPublicPath(repoPath, value) {
  assert.equal(typeof value, "string");
  return value.replace(/^<repo-root>/, repoPath);
}

function runCli(repoPath, args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoPath,
    encoding: "utf8"
  });
  return result;
}

function runMcpTool(repoPath, name, args) {
  const response = runMcp(repoPath, [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name,
        arguments: args
      }
    }
  ])[0];
  assert.ok(response.result, response.error?.message);
  return response.result;
}

function runMcp(repoPath, messages) {
  const input = Buffer.concat(messages.map(encodeMcpFrame));
  const result = spawnSync(process.execPath, [cliPath, "mcp", "--stdio", "--repo", repoPath], {
    cwd: repoPath,
    input,
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024
  });
  assert.equal(result.status, 0, result.stderr.toString("utf8"));
  return parseMcpFrames(result.stdout);
}

function encodeMcpFrame(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8"), body]);
}

function parseMcpFrames(buffer) {
  const messages = [];
  let rest = Buffer.from(buffer);
  while (rest.length > 0) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    if (headerEnd < 0) break;
    const header = rest.subarray(0, headerEnd).toString("utf8");
    const match = /^Content-Length:\s*(\d+)$/im.exec(header);
    assert.ok(match, `invalid MCP response header: ${header}`);
    const length = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    assert.ok(rest.length >= bodyEnd, "incomplete MCP response frame");
    messages.push(JSON.parse(rest.subarray(bodyStart, bodyEnd).toString("utf8")));
    rest = rest.subarray(bodyEnd);
  }
  return messages;
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
