import { runGrapeGetArtifactTool } from "./artifact.js";
import {
  runGrapeRecordCandidateTool,
  runGrapeRecordUserDecisionTool,
  runGrapeRequestUserConfirmationTool
} from "./candidates.js";
import { runGrapeGetClaimsTool } from "./claims.js";
import { runGrapeGetConflictsTool } from "./conflicts.js";
import { runGrapeGetContextTool } from "./get-context.js";
import { runGrapeGetOmittedItemTool } from "./omitted.js";
import { runGrapeRecordCommandResultTool, runGrapeRecordTestResultTool } from "./observations.js";
import { runGrapeGetProofsTool } from "./proofs.js";
import { runGrapeGetRulesTool } from "./rules.js";
import { runGrapeGetStaleItemsTool } from "./stale.js";
import { runGrapeGetStatusTool } from "./status.js";

export { listMcpTools } from "./tool-list.js";

export interface McpToolResult {
  readonly content: readonly [{ readonly type: "text"; readonly text: string }];
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
}

interface ToolCallParams {
  readonly name: string;
  readonly arguments?: unknown;
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
      case "grape_record_candidate":
        return toolResult(runGrapeRecordCandidateTool(params.arguments ?? {}, rootPath), false);
      case "grape_record_command_result":
        return toolResult(runGrapeRecordCommandResultTool(params.arguments ?? {}, rootPath), false);
      case "grape_record_test_result":
        return toolResult(runGrapeRecordTestResultTool(params.arguments ?? {}, rootPath), false);
      case "grape_record_user_decision":
        return toolResult(runGrapeRecordUserDecisionTool(params.arguments ?? {}, rootPath), false);
      case "grape_request_user_confirmation":
        return toolResult(runGrapeRequestUserConfirmationTool(params.arguments ?? {}, rootPath), false);
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
