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
import { summarizeToolResult } from "./tool-result-summary.js";
import { sanitizePublicOutput, sanitizePublicText } from "../shared/index.js";
import { recoveryGuidanceForErrorMessage } from "../app/local-project/setup/recovery.js";

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
        return toolResult(params.name, output, output.unsafeReasons.length > 0, rootPath);
      }
      case "grape_get_artifact":
        return toolResult(params.name, runGrapeGetArtifactTool(params.arguments ?? {}, rootPath), false, rootPath);
      case "grape_get_claims":
        return toolResult(params.name, runGrapeGetClaimsTool(params.arguments ?? {}, rootPath), false, rootPath);
      case "grape_get_proofs":
        return toolResult(params.name, runGrapeGetProofsTool(params.arguments ?? {}, rootPath), false, rootPath);
      case "grape_get_rules":
        return toolResult(params.name, runGrapeGetRulesTool(params.arguments ?? {}, rootPath), false, rootPath);
      case "grape_get_omitted_item": {
        const output = runGrapeGetOmittedItemTool(params.arguments ?? {}, rootPath);
        return toolResult(params.name, output, output.status === "stale", rootPath);
      }
      case "grape_get_stale_items":
        return toolResult(params.name, runGrapeGetStaleItemsTool(params.arguments ?? {}, rootPath), false, rootPath);
      case "grape_get_conflicts":
        return toolResult(params.name, runGrapeGetConflictsTool(params.arguments ?? {}, rootPath), false, rootPath);
      case "grape_get_status":
        assertEmptyArguments(params.arguments, "grape_get_status");
        return toolResult(params.name, runGrapeGetStatusTool(rootPath), false, rootPath);
      case "grape_record_candidate":
        return toolResult(params.name, runGrapeRecordCandidateTool(params.arguments ?? {}, rootPath), false, rootPath);
      case "grape_record_command_result":
        return toolResult(params.name, runGrapeRecordCommandResultTool(params.arguments ?? {}, rootPath), false, rootPath);
      case "grape_record_test_result":
        return toolResult(params.name, runGrapeRecordTestResultTool(params.arguments ?? {}, rootPath), false, rootPath);
      case "grape_record_user_decision":
        return toolResult(params.name, runGrapeRecordUserDecisionTool(params.arguments ?? {}, rootPath), false, rootPath);
      case "grape_request_user_confirmation":
        return toolResult(params.name, runGrapeRequestUserConfirmationTool(params.arguments ?? {}, rootPath), false, rootPath);
      default:
        return toolError(`Unknown Grape MCP tool: ${params.name}`, rootPath);
    }
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error), rootPath);
  }
}

function toolResult(toolName: string, value: unknown, isError: boolean, rootPath: string): McpToolResult {
  const safeValue = sanitizePublicOutput(value, { rootPath });
  return {
    content: [{ type: "text", text: sanitizePublicText(summarizeToolResult(toolName, safeValue), { rootPath }) }],
    structuredContent: safeValue,
    isError
  };
}

function toolError(message: string, rootPath: string): McpToolResult {
  const recoveryGuidance = recoveryGuidanceForErrorMessage(message);
  const text = recoveryGuidance.length > 0
    ? [message, "", "Recovery:", ...recoveryGuidance.map((item) => `- ${item}`)].join("\n")
    : message;
  const structured = recoveryGuidance.length > 0
    ? { error: message, recoveryGuidance }
    : { error: message };
  return {
    content: [{ type: "text", text: sanitizePublicText(text, { rootPath }) }],
    structuredContent: sanitizePublicOutput(structured, { rootPath }),
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
