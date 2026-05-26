import { runGrapeGetArtifactTool } from "./artifact.js";
import { runGrapeGetContextTool } from "./get-context.js";
import { runGrapeGetOmittedItemTool } from "./omitted.js";
import { runGrapeGetProofsTool } from "./proofs.js";
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
        name: "grape_get_status",
        description: "Inspect local Grape bootstrap, migration, and repository state for the current working directory.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {}
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
      case "grape_get_proofs":
        return toolResult(runGrapeGetProofsTool(params.arguments ?? {}, rootPath), false);
      case "grape_get_omitted_item": {
        const output = runGrapeGetOmittedItemTool(params.arguments ?? {}, rootPath);
        return toolResult(output, output.status === "stale");
      }
      case "grape_get_status":
        assertEmptyArguments(params.arguments, "grape_get_status");
        return toolResult(runGrapeGetStatusTool(rootPath), false);
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

function assertEmptyArguments(value: unknown, toolName: string): void {
  if (value === undefined) return;
  if (!isRecord(value)) throw new Error(`${toolName} arguments must be an object when provided`);
  const keys = Object.keys(value);
  if (keys.length > 0) throw new Error(`${toolName} does not support arguments: ${keys.join(", ")}`);
}
