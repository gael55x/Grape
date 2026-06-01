import type { McpConnectionGuide } from "./setup-types.js";

export function mcpConnectionGuide(rootPath = process.cwd()): McpConnectionGuide {
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
    note: "Run grape mcp --stdio --repo <repo-root> to serve Grape context over MCP stdio."
  };
}
