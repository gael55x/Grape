import { sessionIdentityRequirement } from "../../../core/sessions/index.js";
import type { McpConnectionGuide } from "./setup-types.js";

export function mcpConnectionGuide(rootPath = process.cwd()): McpConnectionGuide {
  const mcpCommand = `grape mcp --stdio --repo ${rootPath}`;
  return {
    status: "implemented",
    implemented: true,
    serverName: "grape",
    command: "grape",
    args: ["mcp", "--stdio", "--repo", rootPath],
    cwd: rootPath,
    transport: "stdio",
    tools: [
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
    ],
    note: "Run grape mcp --stdio --repo <repo-root> to serve Grape context over MCP stdio.",
    sessionIdentity: sessionIdentityRequirement,
    primaryTool: "grape_get_context",
    agentInstructionBlock: [
      "Configure Grape as an MCP server in your coding agent.",
      `MCP command: ${mcpCommand}`,
      "",
      "On each turn, call grape_get_context with:",
      "- query: the current task or user request (exact wording matters for derived sessions)",
      "- sessionId: a stable ID for this agent session, OR agentName + agentSessionId",
      "- outputMode: agent_pack (default) for compact transport deltas",
      "",
      sessionIdentityRequirement,
      "Restore omitted context with grape_get_omitted_item using the restore token from RESTORE_AVAILABLE items.",
      "Grape is not a daemon: it tracks context only when the agent calls MCP tools with stable session identity."
    ].join("\n")
  };
}
