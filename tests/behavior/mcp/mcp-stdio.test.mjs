import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");
const packageJsonPath = fileURLToPath(new URL("../../../package.json", import.meta.url));

function readPackageVersion() {
  return JSON.parse(readFileSync(packageJsonPath, "utf8")).version;
}

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

function requestLine(message) {
  return Buffer.from(`${JSON.stringify(message)}\n`, "utf8");
}

function runMcp(repoPath, messages) {
  return runMcpFrom(repoPath, messages, repoPath);
}

function runCliJson(repoPath, args) {
  const result = spawnSync(process.execPath, [cliPath, ...args, "--json"], {
    cwd: repoPath,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function runMcpFrom(repoPath, messages, cwd) {
  const input = Buffer.concat(messages.map(requestLine));
  const result = spawnSync(process.execPath, [cliPath, "mcp", "--stdio", "--repo", repoPath], {
    cwd,
    input,
    encoding: "buffer"
  });
  assert.equal(result.status, 0, result.stderr.toString("utf8"));
  assert.equal(result.stderr.toString("utf8"), "");
  return parseJsonLines(result.stdout);
}

function stripCliOnlyStatusFields(status) {
  const { rootPath: _rootPath, grapeDirPath: _grapeDirPath, configPath: _configPath, databasePath: _databasePath, ...rest } = status;
  return rest;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function parseJsonLines(buffer) {
  const text = Buffer.from(buffer).toString("utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
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
    assert.notEqual(responses[0].result.serverInfo.version, "0.0.0");
    assert.equal(responses[0].result.serverInfo.version, readPackageVersion());
    assert.deepEqual(
      responses[1].result.tools.map((tool) => tool.name),
      [
        "grape_get_context",
        "grape_get_artifact",
        "grape_get_claims",
        "grape_get_proofs",
        "grape_get_rules",
        "grape_get_omitted_item",
        "grape_get_stale_items",
        "grape_get_conflicts",
        "grape_get_status",
        "grape_record_candidate",
        "grape_record_command_result",
        "grape_record_test_result",
        "grape_record_user_decision",
        "grape_request_user_confirmation"
      ]
    );
    const contextTool = responses[1].result.tools.find((tool) => tool.name === "grape_get_context");
    assert.deepEqual(contextTool.inputSchema.anyOf, [{ required: ["sessionId"] }, { required: ["agentSessionId"] }]);
    assert.equal(contextTool.inputSchema.properties.tokenBudget.type, "integer");
    assert.equal(contextTool.inputSchema.properties.tokenBudget.minimum, 1);
    assert.deepEqual(contextTool.inputSchema.properties.outputMode.enum, ["agent_pack", "full"]);
    const commandTool = responses[1].result.tools.find((tool) => tool.name === "grape_record_command_result");
    assert.equal(commandTool.inputSchema.additionalProperties, false);
    assert.match(commandTool.inputSchema.properties.command.description, /not persisted/);
  });
});

test("mcp grape_get_conflicts returns conflict inspection without root paths", () => {
  withGitRepo((repoPath) => {
    writeFileSync(
      path.join(repoPath, "AGENTS.md"),
      [
        "# Rules",
        "",
        "- Never use console logs in production code",
        "- Use console logs in production code"
      ].join("\n")
    );
    execGit(repoPath, ["add", "AGENTS.md"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add conflicting rules"
    ]);
    runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Review console logging rules",
            sessionId: "mcp-conflicts-session"
          }
        }
      }
    ]);

    const conflicts = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_conflicts",
          arguments: {}
        }
      }
    ])[0].result;

    assert.equal(conflicts.isError, false);
    assert.equal(Object.hasOwn(conflicts.structuredContent, "rootPath"), false);
    assert.equal(conflicts.content[0].text.includes(repoPath), false);
    assert.equal(conflicts.structuredContent.conflicts.length, 1);
    assert.equal(conflicts.structuredContent.conflicts[0].authority.createdBy, "deterministic_rule");
    assert.equal(conflicts.structuredContent.conflicts[0].authority.reason, "deterministic project-rule opposing-topic review");
    assert.deepEqual(conflicts.structuredContent.warnings, []);
  });
});

test("mcp restricted write tools record temporary evidence without promoting claims", () => {
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
            sessionId: "mcp-write-session"
          }
        }
      }
    ]);

    const candidateText = "This repository should switch to pnpm next week";
    const candidateResult = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_record_candidate",
          arguments: {
            sessionId: "mcp-write-session",
            subject: "package-manager",
            claimType: "manual_memory_edit",
            claimText: candidateText,
            scope: { branch: "main" },
            reportedBy: "agent"
          }
        }
      }
    ])[0].result;

    assert.equal(candidateResult.isError, false);
    assert.match(candidateResult.structuredContent.candidateId, /^candidate:/);
    assert.equal(candidateResult.structuredContent.durable, false);
    assert.equal(candidateResult.structuredContent.promoted, false);
    assert.equal(Object.hasOwn(candidateResult.structuredContent, "rootPath"), false);
    assert.equal(candidateResult.content[0].text.includes(repoPath), false);
    assert.equal(candidateResult.content[0].text.includes(candidateText), false);

    const claimsAfterCandidate = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "grape_get_claims",
          arguments: { activeOnly: true }
        }
      }
    ])[0].result;
    assert.equal(claimsAfterCandidate.isError, false);
    assert.equal(
      claimsAfterCandidate.structuredContent.claims.some((claim) => claim.claimText.includes(candidateText)),
      false
    );

    const prompt = "Should Grape treat AGENTS.md as pinned project guidance?";
    const response = "Yes, keep AGENTS.md pinned when present.";
    const decisionResult = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "grape_record_user_decision",
          arguments: {
            sessionId: "mcp-write-session",
            prompt,
            promptHash: sha256(prompt),
            response,
            responseHash: sha256(response),
            confirmationChannel: "mcp_user_confirmation",
            confirmedByUser: true,
            confirmedAt: "2026-05-26T00:00:02.000Z",
            scope: { sourceRef: "AGENTS.md" },
            reportedBy: "agent"
          }
        }
      }
    ])[0].result;

    assert.equal(decisionResult.isError, false);
    assert.equal(decisionResult.structuredContent.sourceType, "user_message");
    assert.equal(decisionResult.structuredContent.durable, false);
    assert.deepEqual(decisionResult.structuredContent.redactedFields, ["prompt", "response"]);
    assert.equal(decisionResult.content[0].text.includes(prompt), false);
    assert.equal(decisionResult.content[0].text.includes(response), false);

    const confirmationPrompt = "Confirm this decision before it can become durable evidence.";
    const confirmationResult = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "grape_request_user_confirmation",
          arguments: {
            sessionId: "mcp-write-session",
            prompt: confirmationPrompt,
            promptHash: sha256(confirmationPrompt),
            scope: { subject: "AGENTS.md" },
            reason: "durable decision requires direct confirmation",
            reportedBy: "agent"
          }
        }
      }
    ])[0].result;

    assert.equal(confirmationResult.isError, false);
    assert.match(confirmationResult.structuredContent.confirmationRequestId, /^confirmation:/);
    assert.equal(confirmationResult.structuredContent.status, "requires_user_confirmation");
    assert.equal(confirmationResult.structuredContent.durable, false);
    assert.equal(confirmationResult.content[0].text.includes(confirmationPrompt), false);

    const command = "npm test -- --runInBand";
    const commandResult = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_record_command_result",
          arguments: {
            sessionId: "mcp-write-session",
            command,
            commandHash: sha256(command),
            cwd: ".",
            exitCode: 0,
            stdoutHash: sha256("tests passed"),
            stderrHash: sha256(""),
            startedAt: "2026-05-26T00:00:00.000Z",
            endedAt: "2026-05-26T00:00:01.000Z",
            reportedBy: "agent"
          }
        }
      }
    ])[0].result;

    assert.equal(commandResult.isError, false);
    assert.equal(commandResult.structuredContent.sourceType, "command_run");
    assert.equal(commandResult.structuredContent.trustClass, "temporary");
    assert.equal(commandResult.structuredContent.durable, false);
    assert.equal(Object.hasOwn(commandResult.structuredContent, "rootPath"), false);
    assert.equal(commandResult.content[0].text.includes(repoPath), false);
    assert.equal(commandResult.content[0].text.includes(command), false);
    assert.deepEqual(commandResult.structuredContent.redactedFields, ["command", "stdout", "stderr"]);

    const proofs = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_proofs",
          arguments: { sourceId: commandResult.structuredContent.sourceId }
        }
      }
    ])[0].result;
    assert.equal(proofs.isError, false);
    assert.equal(proofs.structuredContent.proofs.length, 0);

    const testCommand = "npm test";
    const testResult = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "grape_record_test_result",
          arguments: {
            sessionId: "mcp-write-session",
            command: testCommand,
            commandHash: sha256(testCommand),
            cwd: ".",
            exitCode: 1,
            stdoutHash: sha256("one test failed"),
            stderrHash: sha256(""),
            startedAt: "2026-05-26T00:01:00.000Z",
            endedAt: "2026-05-26T00:01:02.000Z",
            passed: false,
            testFramework: "node:test",
            testFiles: ["tests/example.test.ts"]
          }
        }
      }
    ])[0].result;

    assert.equal(testResult.isError, false);
    assert.equal(testResult.structuredContent.sourceType, "test_run");
    assert.equal(testResult.structuredContent.trustClass, "temporary");
    assert.equal(testResult.structuredContent.durable, false);
    assert.equal(testResult.content[0].text.includes(testCommand), false);
  });
});

test("mcp restricted write tools reject grape-observed authority from agents", () => {
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
            sessionId: "mcp-observed-reject-session"
          }
        }
      }
    ]);

    const command = "npm test";
    const rejected = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_record_command_result",
          arguments: {
            sessionId: "mcp-observed-reject-session",
            command,
            commandHash: sha256(command),
            cwd: ".",
            exitCode: 0,
            stdoutHash: sha256(""),
            stderrHash: sha256(""),
            startedAt: "2026-05-26T00:00:00.000Z",
            endedAt: "2026-05-26T00:00:01.000Z",
            observedRunId: "run:agent-minted"
          }
        }
      }
    ])[0].result;

    assert.equal(rejected.isError, true);
    assert.match(rejected.content[0].text, /unsupported observation argument: observedRunId/);

    const outsideCwd = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "grape_record_command_result",
          arguments: {
            sessionId: "mcp-observed-reject-session",
            command,
            commandHash: sha256(command),
            cwd: "../outside",
            exitCode: 0,
            stdoutHash: sha256(""),
            stderrHash: sha256(""),
            startedAt: "2026-05-26T00:00:00.000Z",
            endedAt: "2026-05-26T00:00:01.000Z"
          }
        }
      }
    ])[0].result;

    assert.equal(outsideCwd.isError, true);
    assert.match(outsideCwd.content[0].text, /cwd must be inside the repository root/);

    const prompt = "Did the user approve this durable decision?";
    const response = "yes";
    const badDecision = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "grape_record_user_decision",
          arguments: {
            sessionId: "mcp-observed-reject-session",
            prompt,
            promptHash: sha256(prompt),
            response,
            responseHash: sha256("different response"),
            confirmationChannel: "mcp_user_confirmation",
            confirmedByUser: true,
            confirmedAt: "2026-05-26T00:00:02.000Z",
            scope: { subject: "decision" },
            reportedBy: "agent"
          }
        }
      }
    ])[0].result;

    assert.equal(badDecision.isError, true);
    assert.match(badDecision.content[0].text, /responseHash does not match response/);
    assert.equal(badDecision.content[0].text.includes(response), false);

    const badCandidate = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "grape_record_candidate",
          arguments: {
            sessionId: "mcp-observed-reject-session",
            subject: "unsupported",
            claimType: "manual_memory_edit",
            claimText: "unsupported field must be rejected",
            scope: {},
            promoted: true,
            reportedBy: "agent"
          }
        }
      }
    ])[0].result;

    assert.equal(badCandidate.isError, true);
    assert.match(badCandidate.content[0].text, /unsupported candidate argument: promoted/);
  });
});

test("mcp grape_get_rules returns active rule excerpts without root paths", () => {
  withGitRepo((repoPath) => {
    writeFileSync(path.join(repoPath, "AGENTS.md"), "Prefer exact proof before changing code.\n");
    execGit(repoPath, ["add", "AGENTS.md"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add agent rules"
    ]);

    runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository entry points",
            sessionId: "mcp-rules-session"
          }
        }
      }
    ]);

    const rules = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_rules",
          arguments: {}
        }
      }
    ])[0].result;

    assert.equal(rules.isError, false);
    assert.equal(Object.hasOwn(rules.structuredContent, "rootPath"), false);
    assert.equal(rules.content[0].text.includes(repoPath), false);
    assert.equal(rules.structuredContent.rules.length, 1);
    assert.equal(rules.structuredContent.rules[0].sourceRef, "AGENTS.md");
    assert.match(rules.structuredContent.rules[0].body, /Prefer exact proof/);
    assert.match(rules.structuredContent.rules[0].proofId, /^proof:/);
  });
});

test("mcp grape_get_rules rejects secret-looking rule excerpts", () => {
  withGitRepo((repoPath) => {
    writeFileSync(path.join(repoPath, "AGENTS.md"), "API_KEY=example-value\nPrefer exact proof before changing code.\n");
    execGit(repoPath, ["add", "AGENTS.md"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add unsafe agent rules"
    ]);

    const init = spawnSync(process.execPath, [cliPath, "init", "--connect", "--repo", repoPath], {
      cwd: repoPath,
      encoding: "utf8"
    });
    assert.equal(init.status, 0, init.stderr);

    const rules = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_rules",
          arguments: {}
        }
      }
    ])[0].result;

    assert.equal(rules.isError, false);
    assert.equal(rules.structuredContent.rules.length, 0);
    assert.deepEqual(rules.structuredContent.rejectedRuleRefs, ["AGENTS.md"]);
    assert.deepEqual(rules.structuredContent.warnings, ["rule_file_excerpt_rejected"]);
    assert.equal(rules.content[0].text.includes("example-value"), false);
  });
});

test("mcp grape_get_claims returns active claims without root paths or raw excerpts", () => {
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
            sessionId: "mcp-claims-session"
          }
        }
      }
    ]);

    const claims = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "grape_get_claims",
          arguments: { activeOnly: true }
        }
      }
    ])[0].result;

    assert.equal(claims.isError, false);
    assert.equal(Object.hasOwn(claims.structuredContent, "rootPath"), false);
    assert.equal(claims.content[0].text.includes(repoPath), false);
    assert.equal(claims.structuredContent.claims.length > 0, true);
    const claim = claims.structuredContent.claims[0];
    assert.equal(claim.claimType, "repository_source_excerpt_exists");
    assert.equal(claim.verificationStatus, "verified");
    assert.equal(claim.proofRefs.length > 0, true);
    assert.equal("excerpt" in claim, false);
    assert.equal("body" in claim, false);
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
    assert.equal(artifact.structuredContent.outputMode, "metadata");
    assert.equal(Object.hasOwn(artifact.structuredContent, "rootPath"), false);
    assert.equal(Object.hasOwn(artifact.structuredContent, "artifactBody"), false);
    assert.equal(artifact.content[0].text.includes(repoPath), false);
    assert.equal(artifact.structuredContent.dependencies.length > 0, true);
    assert.match(artifact.structuredContent.artifactFiles.json, /^\.grape\//);

    const fullArtifact = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: context.artifactRef.fullArtifactTool.name,
          arguments: context.artifactRef.fullArtifactTool.arguments
        }
      }
    ])[0].result;

    assert.equal(fullArtifact.isError, false);
    assert.equal(fullArtifact.structuredContent.outputMode, "full");
    assert.equal(Object.hasOwn(fullArtifact.structuredContent, "rootPath"), false);
    assert.equal(fullArtifact.content[0].text.includes(repoPath), false);
    assert.equal(fullArtifact.structuredContent.artifactBody.contextArtifact.id, context.artifactId);
    assert.equal(
      fullArtifact.structuredContent.artifactBody.contextPackItems.some((item) => typeof item.content === "string"),
      true
    );
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
    assert.match(toolResult.content[0].text, /^grape_get_context: mode=agent_pack /);
    assert.equal(toolResult.structuredContent.sessionId, "mcp-session");
    assert.equal(toolResult.structuredContent.branch, "main");
    assert.equal(toolResult.structuredContent.outputMode, "agent_pack");
    assert.equal(Object.hasOwn(toolResult.structuredContent, "contextArtifact"), false);
    assert.equal(toolResult.structuredContent.artifactRef.artifactId, toolResult.structuredContent.artifactId);
    assert.equal(toolResult.structuredContent.artifactRef.fullArtifactTool.name, "grape_get_artifact");
    assert.equal(toolResult.structuredContent.artifactRef.fullArtifactTool.arguments.outputMode, "full");
    assert.equal(Object.hasOwn(toolResult.structuredContent, "agentGraph"), false);
    assert.equal(toolResult.structuredContent.contextPackItems.some((item) => item.state === "NEW"), true);
    const packItem = toolResult.structuredContent.contextPackItems[0];
    assert.equal(typeof packItem.id, "string");
    assert.equal("content" in packItem, false);
    assert.equal(typeof packItem.contentPreview, "string");
    assert.equal(packItem.contentOmitted, true);
    assert.equal(Array.isArray(packItem.inputRefs), true);
    assert.equal(packItem.inputRefs.some((ref) => Object.hasOwn(ref.scope, "repoId")), false);
    assert.equal(packItem.inputRefs.some((ref) => Object.hasOwn(ref.scope, "taskId")), false);
    assert.equal("body" in packItem, false);
    assert.equal(Object.hasOwn(toolResult.structuredContent, "contextPackMarkdown"), false);
    assert.match(toolResult.structuredContent.artifactFiles.json, /^\.grape\//);
    assert.equal(toolResult.structuredContent.artifactRef.artifactFiles.json, toolResult.structuredContent.artifactFiles.json);
    const artifactJson = JSON.parse(
      readFileSync(path.join(repoPath, toolResult.structuredContent.artifactFiles.json), "utf8")
    );
    assert.equal(artifactJson.contextArtifact.id, toolResult.structuredContent.artifactId);
    assert.equal("artifact" in artifactJson, false);
  });
});

test("mcp grape_get_context applies caller environment scope to compiled artifacts", () => {
  withGitRepo((repoPath) => {
    const responses = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain the repository entry points",
            sessionId: "mcp-environment-session",
            environmentScope: "staging",
            outputMode: "full"
          }
        }
      }
    ]);

    const output = responses[0].result.structuredContent;
    assert.equal(output.contextArtifact.environmentScope, "staging");
    assert.equal(output.warnings.includes("mcp_environment_scope_not_applied_in_context_compile"), false);
  });
});

test("mcp grape_get_context accepts caller feature flag scope without exposing flag labels", () => {
  withGitRepo((repoPath) => {
    const responses = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain scoped repository entry points",
            sessionId: "mcp-feature-session",
            featureFlags: { betaCheckout: "rollout_secret" },
            outputMode: "full"
          }
        }
      }
    ]);

    const output = responses[0].result.structuredContent;
    assert.equal(output.currentScope.featureFlagCount, 1);
    assert.equal(typeof output.currentScope.featureFlagScopeHash, "string");
    assert.equal(output.contextArtifact.currentScope.featureFlagCount, 1);
    assert.equal(JSON.stringify(output).includes("betaCheckout"), false);
    assert.equal(JSON.stringify(output).includes("rollout_secret"), false);
  });
});

test("mcp grape_get_context rejects unallowlisted feature flag scope input", () => {
  withGitRepo((repoPath) => {
    const responses = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain scoped repository entry points",
            sessionId: "mcp-feature-unlisted-session",
            featureFlags: { unlistedFlag: true }
          }
        }
      }
    ]);

    const output = responses[0].result;
    assert.equal(output.isError, true);
    assert.match(output.content[0].text, /feature flags must be allowlisted/);
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
    assert.equal(Object.hasOwn(second, "agentGraph"), false);
    assert.equal(Object.hasOwn(second, "contextPackMarkdown"), false);

    const stale = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_stale_items",
          arguments: {
            sessionId: "mcp-branch-session"
          }
        }
      }
    ])[0].result;

    assert.equal(stale.isError, false);
    assert.equal(Object.hasOwn(stale.structuredContent, "rootPath"), false);
    assert.equal(stale.content[0].text.includes(repoPath), false);
    assert.equal(stale.structuredContent.inspectedSessionCount, 1);
    assert.equal(stale.structuredContent.staleItems.some((item) => item.staleReason === "branch_changed"), true);
    assert.equal(stale.structuredContent.staleItems.every((item) => item.invalidatesSentItemId.length > 0), true);
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

test("mcp task mismatch errors include recovery guidance", () => {
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
            sessionId: "mcp-mismatch-session"
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
            query: "Explain a different repository task",
            sessionId: "mcp-mismatch-session"
          }
        }
      }
    ]);

    const toolResult = responses[1].result;
    assert.equal(toolResult.isError, true);
    assert.match(toolResult.structuredContent.error, /task mismatch/);
    assert.ok(Array.isArray(toolResult.structuredContent.recoveryGuidance));
    assert.ok(
      toolResult.structuredContent.recoveryGuidance.some((item) =>
        item.includes("Reuse the exact original")
      )
    );
    assert.match(toolResult.content[0].text, /Recovery:/);
    assert.match(toolResult.content[0].text, /resetSession/);
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
    mkdirSync(path.join(repoPath, "tests"));
    writeFileSync(path.join(repoPath, "src", "main.ts"), "export function mainEntry() { return 'main'; }\n");
    writeFileSync(
      path.join(repoPath, "tests", "main.test.ts"),
      "import { mainEntry } from '../src/main';\n\ntest('mainEntry returns main', () => mainEntry());\n"
    );
    execGit(repoPath, ["add", "src/main.ts", "tests/main.test.ts"]);
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
            tests: ["tests/main.test.ts", "mainEntry regression"],
            tokenBudget: 5000
          }
        }
      }
    ]);

    const output = responses[0].result.structuredContent;
    const artifactJson = JSON.parse(readFileSync(path.join(repoPath, output.artifactFiles.json), "utf8"));
    const retrievalSection = artifactJson.contextArtifact.outputSections.find(
      (section) => section.id === "task-retrieval"
    );

    assert.equal(output.compileMode, "safe_minimum");
    assert.equal(output.warnings.includes("mcp_seed_files_not_used_in_context_compile"), false);
    assert.equal(output.warnings.includes("mcp_token_budget_not_enforced_in_context_compile"), false);
    assert.equal(output.warnings.includes("repository_artifact_uses_lightweight_index"), false);
    assert.equal(output.budget.status, "within_budget");
    assert.equal(retrievalSection.itemRefs.some((ref) => ref.ref === "src/main.ts"), true);
    assert.equal(retrievalSection.itemRefs.some((ref) => ref.ref === "tests/main.test.ts"), true);
    assert.match(retrievalSection.text, /Test seed refs:\n- tests\/main\.test\.ts/);
    assert.match(retrievalSection.text, /Related test refs:\n- tests\/main\.test\.ts/);
    assert.equal(output.warnings.some((warning) => warning.includes("mainEntry regression")), false);
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
    if (Array.isArray(output.recoveryGuidance)) {
      assert.ok(output.recoveryGuidance.some((item) => item.includes("Increase --token-budget")));
    }
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
    if (Array.isArray(output.recoveryGuidance)) {
      assert.ok(output.recoveryGuidance.some((item) => item.includes("exact file or symbol")));
    }
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
      assert.equal(responses[0].result.structuredContent.status, "unknown");
      assert.equal(responses[0].result.structuredContent.databaseReady, false);
      assert.equal(Object.hasOwn(responses[0].result.structuredContent, "rootPath"), false);
      assert.equal(Object.hasOwn(responses[0].result.structuredContent, "grapeDirPath"), false);
      assert.equal(Object.hasOwn(responses[0].result.structuredContent, "configPath"), false);
      assert.equal(Object.hasOwn(responses[0].result.structuredContent, "databasePath"), false);
      assert.equal(Object.hasOwn(responses[0].result.structuredContent, "config"), false);
      assert.equal(JSON.stringify(responses[0]).includes(repoPath), false);
      assert.equal(JSON.stringify(responses[0]).includes(cwd), false);
      assert.ok(
        responses[0].result.structuredContent.recoveryGuidance.includes(
          "Run grape init --connect from the repository root to bootstrap or repair local state."
        )
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

test("mcp grape_get_status matches cli status JSON without CLI-only path fields", () => {
  withGitRepo((repoPath) => {
    const cliStatus = runCliJson(repoPath, ["status"]);
    const responses = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "grape_get_status",
          arguments: {}
        }
      }
    ]);

    const mcpStatus = responses[0].result.structuredContent;
    const expected = stripCliOnlyStatusFields(cliStatus);
    expected.freshness = {
      ...expected.freshness,
      checkedAt: mcpStatus.freshness.checkedAt
    };

    assert.equal(responses[0].result.isError, false);
    assert.deepEqual(mcpStatus, expected);
    assert.match(responses[0].result.content[0].text, /status=unknown/);
    assert.match(responses[0].result.content[0].text, /databaseReady=false/);
  });
});

test("mcp stdio rejects oversized message lines", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "grape-mcp-oversized-"));
  try {
    const result = spawnSync(process.execPath, [cliPath, "mcp", "--stdio", "--repo", cwd], {
      cwd,
      input: Buffer.concat([Buffer.alloc(4 * 1024 * 1024 + 1, "x"), Buffer.from("\n", "utf8")])
    });

    assert.equal(result.status, 0, result.stderr.toString("utf8"));
    const responses = parseJsonLines(result.stdout);
    assert.equal(responses[0].error.code, -32700);
    assert.match(responses[0].error.message, /maximum line size/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("mcp stdio rejects Content-Length header framing", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "grape-mcp-malformed-frame-"));
  try {
    const result = spawnSync(process.execPath, [cliPath, "mcp", "--stdio", "--repo", cwd], {
      cwd,
      input: Buffer.from("Content-Length: 2abc\r\n\r\n{}", "utf8")
    });

    assert.equal(result.status, 0, result.stderr.toString("utf8"));
    const responses = parseJsonLines(result.stdout);
    assert.equal(responses[0].error.code, -32700);
    assert.match(responses[0].error.message, /newline-delimited JSON/);
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
