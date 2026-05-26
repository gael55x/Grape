import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-mcp-stdio-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    writeFileSync(path.join(dir, "README.md"), "# Fixture\n");
    execGit(dir, ["add", "README.md"]);
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

function switchToFeatureBranch(repoPath) {
  execGit(repoPath, ["checkout", "-b", "feature/context"]);
  writeFileSync(path.join(repoPath, "README.md"), "# Feature branch\n");
  execGit(repoPath, ["add", "README.md"]);
  execGit(repoPath, [
    "-c",
    "user.name=Grape Test",
    "-c",
    "user.email=grape@example.test",
    "commit",
    "-m",
    "feature branch change"
  ]);
}

function requestFrame(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8"), body]);
}

function runMcp(repoPath, messages) {
  return runMcpFrom(repoPath, messages, repoPath);
}

function runMcpFrom(repoPath, messages, cwd) {
  const input = Buffer.concat(messages.map(requestFrame));
  const result = spawnSync(process.execPath, [cliPath, "mcp", "--stdio", "--repo", repoPath], {
    cwd,
    input,
    encoding: "buffer"
  });
  assert.equal(result.status, 0, result.stderr.toString("utf8"));
  assert.equal(result.stderr.toString("utf8"), "");
  return parseFrames(result.stdout);
}

function parseFrames(buffer) {
  const messages = [];
  let rest = Buffer.from(buffer);
  while (rest.length > 0) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    assert.notEqual(headerEnd, -1, `missing MCP frame header in ${rest.toString("utf8")}`);
    const header = rest.subarray(0, headerEnd).toString("utf8");
    const match = /^Content-Length:\s*(\d+)$/im.exec(header);
    assert.ok(match, `missing content length in ${header}`);
    const length = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    assert.ok(rest.length >= bodyEnd, "incomplete MCP body");
    messages.push(JSON.parse(rest.subarray(bodyStart, bodyEnd).toString("utf8")));
    rest = rest.subarray(bodyEnd);
  }
  return messages;
}

test("mcp stdio lists implemented Grape tools", () => {
  withGitRepo((repoPath) => {
    const responses = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } }
      },
      { jsonrpc: "2.0", id: 2, method: "tools/list" }
    ]);

    assert.equal(responses.length, 2);
    assert.equal(responses[0].result.serverInfo.name, "grape");
    assert.deepEqual(
      responses[1].result.tools.map((tool) => tool.name),
      [
        "grape_get_context",
        "grape_get_artifact",
        "grape_get_proofs",
        "grape_get_omitted_item",
        "grape_get_status"
      ]
    );
    const contextTool = responses[1].result.tools.find((tool) => tool.name === "grape_get_context");
    assert.deepEqual(contextTool.inputSchema.anyOf, [{ required: ["sessionId"] }, { required: ["agentSessionId"] }]);
    assert.equal(contextTool.inputSchema.properties.tokenBudget.type, "integer");
    assert.equal(contextTool.inputSchema.properties.tokenBudget.minimum, 1);
  });
});

test("mcp grape_get_proofs returns proof metadata without raw excerpts or root paths", () => {
  withGitRepo((repoPath) => {
    const context = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository entry points",
            sessionId: "mcp-proofs-session"
          }
        }
      }
    ])[0].result.structuredContent;

    assert.equal(context.artifactId.length > 0, true);

    const proofs = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_proofs",
          arguments: {}
        }
      }
    ])[0].result;

    assert.equal(proofs.isError, false);
    assert.equal(Object.hasOwn(proofs.structuredContent, "rootPath"), false);
    assert.equal(proofs.content[0].text.includes(repoPath), false);
    assert.equal(proofs.structuredContent.proofs.length > 0, true);
    const proof = proofs.structuredContent.proofs[0];
    assert.equal(proof.proofType, "exact_source_excerpt");
    assert.equal(proof.supportStatus, "direct");
    assert.equal("excerpt" in proof, false);
    assert.equal("body" in proof, false);

    const proofDetail = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_proofs",
          arguments: { proofId: proof.proofId }
        }
      }
    ])[0].result;

    assert.equal(proofDetail.isError, false);
    assert.equal(proofDetail.structuredContent.proofs.length, 1);
    assert.equal(proofDetail.structuredContent.proofs[0].proofId, proof.proofId);
  });
});

test("mcp grape_get_artifact returns artifact metadata without absolute root paths", () => {
  withGitRepo((repoPath) => {
    const context = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository entry points",
            sessionId: "mcp-artifact-session"
          }
        }
      }
    ])[0].result.structuredContent;

    const artifact = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_artifact",
          arguments: {
            artifactId: context.artifactId
          }
        }
      }
    ])[0].result;

    assert.equal(artifact.isError, false);
    assert.equal(artifact.structuredContent.artifactId, context.artifactId);
    assert.equal(Object.hasOwn(artifact.structuredContent, "rootPath"), false);
    assert.equal(artifact.content[0].text.includes(repoPath), false);
    assert.equal(artifact.structuredContent.dependencies.length > 0, true);
    assert.match(artifact.structuredContent.artifactFiles.json, /^\.grape\//);
  });
});

test("mcp grape_get_omitted_item restores a restorable omitted context item", () => {
  withGitRepo((repoPath) => {
    const { restoreToken } = createMcpRestorableOmission(repoPath, "mcp-restore-session");

    const restored = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_omitted_item",
          arguments: {
            sessionId: "mcp-restore-session",
            restoreToken
          }
        }
      }
    ])[0].result;

    assert.equal(restored.isError, false);
    assert.equal(restored.structuredContent.status, "restored");
    assert.equal(Object.hasOwn(restored.structuredContent, "rootPath"), false);
    assert.equal(restored.content[0].text.includes(repoPath), false);
    assert.equal(restored.structuredContent.sectionId, "task");
    assert.match(restored.structuredContent.body, /Task type/);
  });
});

test("mcp grape_get_omitted_item rejects stale restore tokens without returning a body", () => {
  withGitRepo((repoPath) => {
    const { restoreToken } = createMcpRestorableOmission(repoPath, "mcp-stale-restore-session");
    writeFileSync(path.join(repoPath, "README.md"), "# Fixture changed\n");

    const stale = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_omitted_item",
          arguments: {
            sessionId: "mcp-stale-restore-session",
            restoreToken
          }
        }
      }
    ])[0].result;

    assert.equal(stale.isError, true);
    assert.equal(stale.structuredContent.status, "stale");
    assert.equal(Object.hasOwn(stale.structuredContent, "rootPath"), false);
    assert.equal(stale.structuredContent.body, undefined);
    assert.ok(stale.structuredContent.warnings.includes("restore_token_rejects_stale_dependency"));
  });
});

test("mcp grape_get_context compiles and returns structured context pack output", () => {
  withGitRepo((repoPath) => {
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
          arguments: {
            query: "Explain the repository entry points",
            sessionId: "mcp-session"
          }
        }
      }
    ]);

    const toolResult = responses[1].result;
    assert.equal(toolResult.isError, false);
    assert.equal(toolResult.content[0].type, "text");
    assert.equal(toolResult.structuredContent.sessionId, "mcp-session");
    assert.equal(toolResult.structuredContent.branch, "main");
    assert.equal(toolResult.structuredContent.contextArtifact.id, toolResult.structuredContent.artifactId);
    assert.equal(toolResult.structuredContent.contextArtifact.artifactFormatVersion, 1);
    assert.equal(toolResult.structuredContent.contextPackItems.some((item) => item.state === "NEW"), true);
    const packItem = toolResult.structuredContent.contextPackItems[0];
    assert.equal(typeof packItem.id, "string");
    assert.equal(typeof packItem.content, "string");
    assert.equal(Array.isArray(packItem.inputRefs), true);
    assert.equal("body" in packItem, false);
    assert.match(toolResult.structuredContent.contextPackMarkdown, /# Grape Context Pack/);
    assert.match(toolResult.structuredContent.artifactFiles.json, /^\.grape\//);
    const artifactJson = JSON.parse(
      readFileSync(path.join(repoPath, toolResult.structuredContent.artifactFiles.json), "utf8")
    );
    assert.equal(artifactJson.contextArtifact.id, toolResult.structuredContent.artifactId);
    assert.equal("artifact" in artifactJson, false);
  });
});

test("mcp grape_get_context invalidates prior sent context when a session switches branches", () => {
  withGitRepo((repoPath) => {
    runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository entry points",
            sessionId: "mcp-branch-session"
          }
        }
      }
    ]);

    switchToFeatureBranch(repoPath);

    const second = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository entry points",
            sessionId: "mcp-branch-session"
          }
        }
      }
    ])[0].result.structuredContent;

    assert.equal(second.branch, "feature/context");
    assert.equal(second.diffSummary.invalidatedItems > 0, true);
    assert.equal(second.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"), true);
    assert.equal(second.contextPackItems.some((item) => item.state === "NEW"), true);
    assert.equal(second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), false);
  });
});

test("mcp grape_get_context resetSession forces full resend for a reused session", () => {
  withGitRepo((repoPath) => {
    runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository entry points",
            sessionId: "mcp-reset-session"
          }
        }
      },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository entry points",
            sessionId: "mcp-reset-session"
          }
        }
      }
    ]);

    const reset = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository entry points",
            sessionId: "mcp-reset-session",
            resetSession: true
          }
        }
      }
    ])[0].result.structuredContent;

    assert.match(reset.sessionResetId, /^reset:/);
    assert.equal(reset.diffSummary.invalidatedItems > 0, true);
    assert.equal(reset.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"), true);
    assert.equal(reset.contextPackItems.some((item) => item.state === "NEW"), true);
    assert.equal(reset.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), false);
  });
});

test("mcp grape_get_context exposes unsafe compile mode for risk overlays", () => {
  withGitRepo((repoPath) => {
    const responses = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Review authentication changes",
            agentSessionId: "agent-risk-session"
          }
        }
      }
    ]);

    const toolResult = responses[0].result;
    assert.equal(toolResult.isError, true);
    assert.equal(toolResult.structuredContent.compileMode, "cannot_compile_safely");
    assert.deepEqual(toolResult.structuredContent.riskOverlays, ["auth"]);
    assert.deepEqual(toolResult.structuredContent.unsafeReasons, ["risk_overlay_missing_exact_context"]);
  });
});

test("mcp grape_get_context requires a session identity", () => {
  withGitRepo((repoPath) => {
    const responses = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository"
          }
        }
      }
    ]);

    const toolResult = responses[0].result;
    assert.equal(toolResult.isError, true);
    assert.match(toolResult.content[0].text, /requires sessionId or agentSessionId/);
  });
});

test("mcp agentSessionId maps to an isolated stable Grape session", () => {
  withGitRepo((repoPath) => {
    const first = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository",
            agentName: "codex",
            agentSessionId: "agent-one"
          }
        }
      }
    ])[0].result.structuredContent;

    const second = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository",
            agentName: "codex",
            agentSessionId: "agent-two"
          }
        }
      }
    ])[0].result.structuredContent;

    assert.notEqual(first.sessionId, second.sessionId);
    assert.equal(first.contextPackItems.some((item) => item.state === "NEW"), true);
    assert.equal(second.contextPackItems.some((item) => item.state === "NEW"), true);
  });
});

test("mcp seed files participate in retrieval while token budget is evaluated", () => {
  withGitRepo((repoPath) => {
    mkdirSync(path.join(repoPath, "src"));
    writeFileSync(path.join(repoPath, "src", "main.ts"), "export function mainEntry() { return 'main'; }\n");
    execGit(repoPath, ["add", "src/main.ts"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add main source"
    ]);

    const responses = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository",
            sessionId: "seed-warning-session",
            files: ["src/main.ts"],
            tokenBudget: 1200
          }
        }
      }
    ]);

    const output = responses[0].result.structuredContent;
    const artifactJson = JSON.parse(readFileSync(path.join(repoPath, output.artifactFiles.json), "utf8"));
    const retrievalSection = artifactJson.contextArtifact.outputSections.find(
      (section) => section.id === "task-retrieval"
    );

    assert.equal(output.compileMode, "partial_with_risk");
    assert.equal(output.warnings.includes("mcp_seed_files_not_used_in_scaffold_compile"), false);
    assert.equal(output.warnings.includes("mcp_token_budget_not_enforced_in_scaffold_compile"), false);
    assert.equal(output.budget.status, "within_budget");
    assert.equal(retrievalSection.itemRefs.some((ref) => ref.ref === "src/main.ts"), true);
  });
});

test("mcp token budget below required context fails closed", () => {
  withGitRepo((repoPath) => {
    const responses = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository",
            sessionId: "tiny-budget-session",
            tokenBudget: 1
          }
        }
      }
    ]);

    const output = responses[0].result.structuredContent;
    assert.equal(output.compileMode, "cannot_compile_safely");
    assert.equal(output.budget.status, "required_context_exceeds_budget");
    assert.ok(output.unsafeReasons.includes("token_budget_below_required_context"));
  });
});

test("mcp file hints participate in risk overlay detection", () => {
  withGitRepo((repoPath) => {
    const responses = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Fix bug",
            sessionId: "auth-file-session",
            files: ["src/auth/session.ts"]
          }
        }
      }
    ]);

    const output = responses[0].result.structuredContent;
    assert.equal(output.compileMode, "cannot_compile_safely");
    assert.deepEqual(output.riskOverlays, ["auth"]);
  });
});

test("mcp stdio can launch outside the repository when --repo is provided", () => {
  withGitRepo((repoPath) => {
    const cwd = mkdtempSync(path.join(tmpdir(), "grape-mcp-nonrepo-"));
    try {
      const responses = runMcpFrom(
        repoPath,
        [
          {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
              name: "grape_get_status",
              arguments: {}
            }
          }
        ],
        cwd
      );

      assert.equal(responses[0].result.isError, false);
      assert.equal(responses[0].result.structuredContent.rootPath, realpathSync(repoPath));
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

test("mcp stdio rejects oversized frames", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "grape-mcp-oversized-"));
  try {
    const result = spawnSync(process.execPath, [cliPath, "mcp", "--stdio", "--repo", cwd], {
      cwd,
      input: Buffer.from("Content-Length: 4194305\r\n\r\n", "utf8")
    });

    assert.equal(result.status, 0, result.stderr.toString("utf8"));
    const responses = parseFrames(result.stdout);
    assert.equal(responses[0].error.code, -32700);
    assert.match(responses[0].error.message, /maximum frame size/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("mcp grape_get_context rejects unsupported arguments", () => {
  withGitRepo((repoPath) => {
    const responses = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository",
            riskOverlays: ["security"]
          }
        }
      }
    ]);

    const toolResult = responses[0].result;
    assert.equal(toolResult.isError, true);
    assert.match(toolResult.content[0].text, /unsupported grape_get_context argument: riskOverlays/);
  });
});

function createMcpRestorableOmission(repoPath, sessionId) {
  runMcp(repoPath, [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "grape_get_context",
        arguments: {
          query: "Explain the repository entry points",
          sessionId
        }
      }
    }
  ]);
  const second = runMcp(repoPath, [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "grape_get_context",
        arguments: {
          query: "Explain the repository entry points",
          sessionId
        }
      }
    }
  ])[0].result.structuredContent;
  const restoreToken = second.contextPackItems.find((item) => item.state === "RESTORE_AVAILABLE")?.restoreId;
  assert.ok(restoreToken);
  return { restoreToken };
}
