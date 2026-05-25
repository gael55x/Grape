import type { McpConnectionGuide } from "./types.js";

export function mcpConnectionGuide(): McpConnectionGuide {
  return {
    status: "contract_only",
    implemented: false,
    serverName: "grape",
    command: "grape",
    args: ["mcp", "--stdio"],
    transport: "stdio",
    note: "The stdio MCP server is not implemented in the current setup slice."
  };
}
