import { runGrapeGetArtifactTool } from "./artifact.js";
import { runGrapeGetClaimsTool } from "./claims.js";
import { runGrapeGetConflictsTool } from "./conflicts.js";
import { runGrapeGetContextTool } from "./get-context.js";
import { runGrapeGetOmittedItemTool } from "./omitted.js";
import { runGrapeRecordCommandResultTool, runGrapeRecordTestResultTool } from "./observations.js";
import { runGrapeGetProofsTool } from "./proofs.js";
import { runGrapeGetRulesTool } from "./rules.js";
import { runGrapeGetStaleItemsTool } from "./stale.js";
import { runGrapeGetStatusTool } from "./status.js";

export interface McpToolResult {
  readonly content: readonly [{ readonly type: "text"; readonly text: string }];
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
}

interface ToolCallParams {
  readonly name: string;
  readonly arguments?: unknown;
}

export function listMcpTools(): { readonly tools: readonly unknown[] } {
  return {
    tools: [
      {
        name: "grape_get_context",
        description:
          "Compile a branch-aware, dependency-tracked scaffold context pack for the current repository and session.",
        inputSchema: {
          type: "object",
          required: ["query"],
          anyOf: [{ required: ["sessionId"] }, { required: ["agentSessionId"] }],
          additionalProperties: false,
          properties: {
            query: {
              type: "string",
              minLength: 1,
              description: "Task or question the coding agent needs grounded context for."
            },
            taskType: {
              type: "string",
              enum: ["bug_fix", "security_fix", "refactor", "migration", "feature", "test_repair", "analysis"]
            },
            files: { type: "array", items: { type: "string", minLength: 1 } },
            symbols: { type: "array", items: { type: "string", minLength: 1 } },
            tests: { type: "array", items: { type: "string", minLength: 1 } },
            environmentScope: {
              type: "string",
              enum: ["local", "test", "ci", "staging", "production", "unknown"]
            },
            tokenBudget: { type: "integer", minimum: 1 },
            sessionId: { type: "string", minLength: 1 },
            agentName: { type: "string", minLength: 1 },
            agentSessionId: { type: "string", minLength: 1 },
            resetSession: {
              type: "boolean",
              description: "Force full resend for this session because the agent lost prior context."
            }
          }
        }
      },
      {
        name: "grape_get_artifact",
        description: "Inspect stored scaffold context artifact metadata and dependency rows.",
        inputSchema: {
          type: "object",
          required: ["artifactId"],
          additionalProperties: false,
          properties: {
            artifactId: { type: "string", minLength: 1 }
          }
        }
      },
      {
        name: "grape_get_claims",
        description: "Inspect current-valid durable claims without returning raw source bodies.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            activeOnly: { type: "boolean" }
          }
        }
      },
      {
        name: "grape_get_proofs",
        description: "Inspect persisted exact-source proof rows without returning proof excerpts or raw source text.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            proofId: { type: "string", minLength: 1 },
            sourceId: { type: "string", minLength: 1 }
          }
        }
      },
      {
        name: "grape_get_rules",
        description: "Inspect current Git-visible project rule excerpts after source-hash and secret-scan checks.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {}
        }
      },
      {
        name: "grape_get_omitted_item",
        description: "Restore an omitted context item by session and restore token.",
        inputSchema: {
          type: "object",
          required: ["sessionId", "restoreToken"],
          additionalProperties: false,
          properties: {
            sessionId: { type: "string", minLength: 1 },
            restoreToken: { type: "string", minLength: 1 }
          }
        }
      },
      {
        name: "grape_get_stale_items",
        description: "Inspect emitted stale-context invalidations without returning context bodies.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            sessionId: { type: "string", minLength: 1 }
          }
        }
      },
      {
        name: "grape_get_conflicts",
        description: "Inspect recorded claim conflict edges without resolving them.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {}
        }
      },
      {
        name: "grape_get_status",
        description: "Inspect local Grape bootstrap, migration, and repository state for the current working directory.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {}
        }
      },
      {
        name: "grape_record_command_result",
        description: "Record agent-reported command-result evidence as temporary, non-promoted local evidence.",
        inputSchema: {
          type: "object",
          required: [
            "sessionId",
            "command",
            "commandHash",
            "cwd",
            "exitCode",
            "stdoutHash",
            "stderrHash",
            "startedAt",
            "endedAt"
          ],
          additionalProperties: false,
          properties: observationProperties()
        }
      },
      {
        name: "grape_record_test_result",
        description: "Record agent-reported test-result evidence as temporary, non-promoted local evidence.",
        inputSchema: {
          type: "object",
          required: [
            "sessionId",
            "command",
            "commandHash",
            "cwd",
            "exitCode",
            "stdoutHash",
            "stderrHash",
            "startedAt",
            "endedAt",
            "passed"
          ],
          additionalProperties: false,
          properties: {
            ...observationProperties(),
            passed: { type: "boolean" },
            testFramework: { type: "string", minLength: 1 },
            testFiles: { type: "array", items: { type: "string", minLength: 1 } }
          }
        }
      }
    ]
  };
}

export function parseToolCallParams(params: unknown): ToolCallParams {
  if (!isRecord(params)) throw new Error("tools/call params must be an object");
  if (typeof params.name !== "string" || params.name.trim() === "") {
    throw new Error("tools/call params.name must be a non-empty string");
  }
  return {
    name: params.name,
    arguments: params.arguments
  };
}

export function callMcpTool(params: ToolCallParams, rootPath: string): McpToolResult {
  try {
    switch (params.name) {
      case "grape_get_context": {
        const output = runGrapeGetContextTool(params.arguments ?? {}, rootPath);
        return toolResult(output, output.unsafeReasons.length > 0);
      }
      case "grape_get_artifact":
        return toolResult(runGrapeGetArtifactTool(params.arguments ?? {}, rootPath), false);
      case "grape_get_claims":
        return toolResult(runGrapeGetClaimsTool(params.arguments ?? {}, rootPath), false);
      case "grape_get_proofs":
        return toolResult(runGrapeGetProofsTool(params.arguments ?? {}, rootPath), false);
      case "grape_get_rules":
        return toolResult(runGrapeGetRulesTool(params.arguments ?? {}, rootPath), false);
      case "grape_get_omitted_item": {
        const output = runGrapeGetOmittedItemTool(params.arguments ?? {}, rootPath);
        return toolResult(output, output.status === "stale");
      }
      case "grape_get_stale_items":
        return toolResult(runGrapeGetStaleItemsTool(params.arguments ?? {}, rootPath), false);
      case "grape_get_conflicts":
        return toolResult(runGrapeGetConflictsTool(params.arguments ?? {}, rootPath), false);
      case "grape_get_status":
        assertEmptyArguments(params.arguments, "grape_get_status");
        return toolResult(runGrapeGetStatusTool(rootPath), false);
      case "grape_record_command_result":
        return toolResult(runGrapeRecordCommandResultTool(params.arguments ?? {}, rootPath), false);
      case "grape_record_test_result":
        return toolResult(runGrapeRecordTestResultTool(params.arguments ?? {}, rootPath), false);
      default:
        return toolError(`Unknown Grape MCP tool: ${params.name}`);
    }
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

function toolResult(value: unknown, isError: boolean): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
    isError
  };
}

function toolError(message: string): McpToolResult {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { error: message },
    isError: true
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function observationProperties(): Record<string, unknown> {
  return {
    sessionId: { type: "string", minLength: 1 },
    command: {
      type: "string",
      minLength: 1,
      description: "Raw command used only to verify commandHash; it is not persisted."
    },
    commandHash: { type: "string", pattern: "^[A-Fa-f0-9]{64}$" },
    cwd: { type: "string", minLength: 1 },
    exitCode: { type: "integer" },
    stdoutHash: { type: "string", pattern: "^[A-Fa-f0-9]{64}$" },
    stderrHash: { type: "string", pattern: "^[A-Fa-f0-9]{64}$" },
    startedAt: { type: "string", minLength: 1 },
    endedAt: { type: "string", minLength: 1 },
    reportedBy: { type: "string", enum: ["agent"] }
  };
}

function assertEmptyArguments(value: unknown, toolName: string): void {
  if (value === undefined) return;
  if (!isRecord(value)) throw new Error(`${toolName} arguments must be an object when provided`);
  const keys = Object.keys(value);
  if (keys.length > 0) throw new Error(`${toolName} does not support arguments: ${keys.join(", ")}`);
}
