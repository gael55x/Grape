/**
 * Beta transport contract tests.
 *
 * These tests protect the stable beta transport boundary defined in
 * docs/v1/contracts/transport-stability.md. They assert field presence,
 * types, and nullable/applicability semantics - not specific non-empty values
 * or internal content.
 *
 * Experimental surfaces (agentGraph, recoveryGuidance, contextPackMarkdown)
 * are optional: they are checked for shape only when present.
 * Debug-only warnings are never required.
 */

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-beta-contract-"));
  try {
    execGit(dir, ["init", "-b", "main"]);
    writeFileSync(path.join(dir, "README.md"), "# Beta contract fixture\n");
    execGit(dir, ["add", "README.md"]);
    execGit(dir, [
      "-c", "user.name=Grape Test", "-c", "user.email=grape@example.test",
      "commit", "-m", "initial fixture"
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

function requestFrame(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8"), body]);
}

function parseFrames(buffer) {
  const messages = [];
  let rest = Buffer.from(buffer);
  while (rest.length > 0) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    assert.notEqual(headerEnd, -1, `missing MCP frame header`);
    const header = rest.subarray(0, headerEnd).toString("utf8");
    const match = /^Content-Length:\s*(\d+)$/im.exec(header);
    assert.ok(match, `missing content length`);
    const length = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    messages.push(JSON.parse(rest.subarray(bodyStart, bodyEnd).toString("utf8")));
    rest = rest.subarray(bodyEnd);
  }
  return messages;
}

function runMcp(repoPath, messages) {
  const input = Buffer.concat(messages.map(requestFrame));
  const result = spawnSync(process.execPath, [cliPath, "mcp", "--stdio", "--repo", repoPath], {
    cwd: repoPath,
    input,
    encoding: "buffer"
  });
  assert.equal(result.status, 0, result.stderr.toString("utf8"));
  return parseFrames(result.stdout);
}

function getContextResponse(repoPath, extraArgs = {}) {
  const responses = runMcp(repoPath, [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } }
    },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "grape_get_context",
        arguments: { query: "Explain the repository", sessionId: "contract-test-session", ...extraArgs }
      }
    }
  ]);
  assert.equal(responses[1].result.isError, false);
  return responses[1].result.structuredContent;
}

// --- Core identifier fields ---

test("beta transport: core identifier fields are non-empty strings", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);

    assert.equal(typeof sc.artifactId, "string");
    assert.ok(sc.artifactId.length > 0);
    assert.equal(typeof sc.artifactHash, "string");
    assert.ok(sc.artifactHash.length > 0);
    assert.equal(typeof sc.dependencyManifestHash, "string");
    assert.ok(sc.dependencyManifestHash.length > 0);
    assert.equal(typeof sc.sessionId, "string");
    assert.ok(sc.sessionId.length > 0);
    assert.equal(typeof sc.branch, "string");
    assert.ok(sc.branch.length > 0);
    assert.equal(typeof sc.headCommit, "string");
    assert.ok(sc.headCommit.length > 0);
  });
});

// --- VCS / compile state fields ---

test("beta transport: VCS and compile state fields have correct types", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);

    assert.equal(typeof sc.dirtyWorktree, "boolean");
    assert.equal(typeof sc.taskType, "string");
    assert.equal(typeof sc.compileMode, "string");
    assert.equal(sc.outputMode, "agent_pack");
    assert.ok(Array.isArray(sc.riskOverlays));
    assert.ok(Array.isArray(sc.warnings));
    assert.ok(Array.isArray(sc.unsafeReasons));
  });
});

// --- Default agent_pack output ---

test("beta transport: default outputMode is agent_pack with no embedded contextArtifact", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);

    assert.equal(sc.outputMode, "agent_pack");
    assert.equal(Object.hasOwn(sc, "contextArtifact"), false);
  });
});

// --- artifactRef shape ---

test("beta transport: artifactRef has required stable fields", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);
    const ref = sc.artifactRef;

    assert.equal(typeof ref, "object");
    assert.ok(ref !== null);
    assert.equal(typeof ref.artifactId, "string");
    assert.ok(ref.artifactId.length > 0);
    assert.equal(ref.artifactId, sc.artifactId);
    assert.equal(typeof ref.artifactHash, "string");
    assert.equal(typeof ref.dependencyManifestHash, "string");
    assert.equal(typeof ref.artifactFiles.json, "string");
    assert.ok(ref.artifactFiles.json.startsWith(".grape/"));
    assert.equal(typeof ref.artifactFiles.markdown, "string");
    assert.equal(ref.fullArtifactTool.name, "grape_get_artifact");
    assert.equal(ref.fullArtifactTool.arguments.artifactId, sc.artifactId);
    assert.equal(ref.fullArtifactTool.arguments.outputMode, "full");
  });
});

// --- contextPackItems compact shape ---

test("beta transport: agent_pack items have contentPreview and contentOmitted, no content", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);

    assert.ok(Array.isArray(sc.contextPackItems));
    for (const item of sc.contextPackItems) {
      assert.equal(typeof item.id, "string");
      assert.equal(typeof item.state, "string");
      assert.equal(typeof item.itemKind, "string");
      assert.equal(typeof item.title, "string");
      assert.equal(typeof item.contentPreview, "string");
      assert.equal(item.contentOmitted, true);
      assert.equal(typeof item.contentHash, "string");
      assert.equal(typeof item.tokenCount, "number");
      assert.equal(typeof item.pinned, "boolean");
      assert.equal(typeof item.safetyCritical, "boolean");
      assert.ok(Array.isArray(item.inputRefs));
      assert.ok(Array.isArray(item.warnings));
      // content field must not be present in agent_pack
      assert.equal(Object.hasOwn(item, "content"), false);
    }
  });
});

test("beta transport: compact inputRefs do not expose repoId, taskId, or sessionId", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);

    for (const item of sc.contextPackItems) {
      for (const ref of item.inputRefs) {
        assert.equal(Object.hasOwn(ref.scope ?? {}, "repoId"), false);
        assert.equal(Object.hasOwn(ref.scope ?? {}, "taskId"), false);
        assert.equal(Object.hasOwn(ref.scope ?? {}, "sessionId"), false);
      }
    }
  });
});

// --- diffSummary shape ---

test("beta transport: diffSummary has all six diff state counts", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);
    const ds = sc.diffSummary;

    assert.equal(typeof ds, "object");
    assert.equal(typeof ds.newItems, "number");
    assert.equal(typeof ds.changedItems, "number");
    assert.equal(typeof ds.pinnedItems, "number");
    assert.equal(typeof ds.omittedItems, "number");
    assert.equal(typeof ds.invalidatedItems, "number");
    assert.equal(typeof ds.restoreAvailableItems, "number");
  });
});

// --- Safety fields ---

test("beta transport: safety fields are arrays and restoreAvailable is boolean", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);

    assert.ok(Array.isArray(sc.warnings));
    assert.ok(Array.isArray(sc.unsafeReasons));
    assert.equal(typeof sc.restoreAvailable, "boolean");
  });
});

test("beta transport: budget has a status field from the documented enum", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);
    const budget = sc.budget;

    assert.equal(typeof budget, "object");
    assert.ok(budget !== null);
    const validStatuses = ["not_requested", "within_budget", "over_budget", "required_context_exceeds_budget"];
    assert.ok(validStatuses.includes(budget.status), `unexpected budget.status: ${budget.status}`);
  });
});

// --- artifactFiles ---

test("beta transport: artifactFiles json and markdown are repo-relative paths", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);

    assert.equal(typeof sc.artifactFiles.json, "string");
    assert.ok(sc.artifactFiles.json.startsWith(".grape/"));
    assert.equal(typeof sc.artifactFiles.markdown, "string");
    assert.ok(sc.artifactFiles.markdown.startsWith(".grape/"));
  });
});

// --- currentScope shape ---

test("beta transport: currentScope is an object with documented routing fields", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);
    const scope = sc.currentScope;

    assert.equal(typeof scope, "object");
    assert.ok(scope !== null);
    assert.equal(typeof scope.branch, "string");
    assert.equal(typeof scope.commit, "string");
    assert.equal(typeof scope.dirtyWorktree, "boolean");
    assert.equal(typeof scope.environment, "string");
    assert.ok(Array.isArray(scope.warnings));
  });
});

// --- Stored artifact envelope version ---

test("beta transport: stored artifact file has artifactFormatVersion and correct envelope", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);
    const artifactPath = path.join(repoPath, sc.artifactFiles.json);
    const stored = JSON.parse(readFileSync(artifactPath, "utf8"));

    assert.equal(stored.artifactFormat, "grape.context-pack.v1");
    assert.equal(stored.artifactFormatVersion, 1);
    assert.ok(Array.isArray(stored.contextPackItems));
    assert.equal(typeof stored.contextArtifact, "object");
    assert.ok(stored.contextArtifact !== null);
  });
});

// --- Experimental fields - optional shape checks ---

test("beta transport: agentGraph when present has graphFormat and nodeCounts", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);

    if (Object.hasOwn(sc, "agentGraph") && sc.agentGraph !== null) {
      assert.equal(typeof sc.agentGraph.graphFormat, "string");
      assert.equal(typeof sc.agentGraph.nodeCounts, "object");
      assert.ok(Array.isArray(sc.agentGraph.nodes));
      assert.ok(Array.isArray(sc.agentGraph.edges));
    }
  });
});

test("beta transport: contextPackMarkdown when present is a string", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);

    if (Object.hasOwn(sc, "contextPackMarkdown")) {
      assert.equal(typeof sc.contextPackMarkdown, "string");
    }
  });
});

test("beta transport: recoveryGuidance when present is an array", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);

    if (Object.hasOwn(sc, "recoveryGuidance") && sc.recoveryGuidance !== null) {
      assert.ok(Array.isArray(sc.recoveryGuidance));
    }
  });
});

// --- Stable warning taxonomy patterns ---

test("beta transport: documented stable warning patterns match when emitted", () => {
  withGitRepo((repoPath) => {
    const sc = getContextResponse(repoPath);

    for (const warning of sc.warnings) {
      if (warning.startsWith("task_retrieval_omitted_over_cap:")) {
        const countPart = warning.slice("task_retrieval_omitted_over_cap:".length);
        assert.ok(
          /^\d+$/.test(countPart),
          `task_retrieval_omitted_over_cap suffix must be a numeric count, got: ${warning}`
        );
        assert.equal(
          warning.includes("sample"),
          false,
          "sample refs must not appear in the stable default omitted warning"
        );
      }
      if (warning.startsWith("task_retrieval_seed_packages_omitted_over_cap:")) {
        const countPart = warning.slice("task_retrieval_seed_packages_omitted_over_cap:".length);
        assert.ok(
          /^\d+$/.test(countPart),
          `task_retrieval_seed_packages_omitted_over_cap suffix must be a numeric count, got: ${warning}`
        );
      }
      if (warning.startsWith("task_retrieval_package_groups_omitted_over_cap:")) {
        const countPart = warning.slice("task_retrieval_package_groups_omitted_over_cap:".length);
        assert.ok(
          /^\d+$/.test(countPart),
          `task_retrieval_package_groups_omitted_over_cap suffix must be a numeric count, got: ${warning}`
        );
      }
      if (warning.startsWith("task_retrieval_language_groups_omitted_over_cap:")) {
        const countPart = warning.slice("task_retrieval_language_groups_omitted_over_cap:".length);
        assert.ok(
          /^\d+$/.test(countPart),
          `task_retrieval_language_groups_omitted_over_cap suffix must be a numeric count, got: ${warning}`
        );
      }
    }
  });
});
