import type { McpConnectionGuide } from "./types.js";

export function mcpConnectionGuide(rootPath = process.cwd()): McpConnectionGuide {
  return {
    status: "implemented",
    implemented: true,
    serverName: "grape",
    command: "grape",
    args: ["mcp", "--stdio", "--repo", rootPath],
    cwd: rootPath,
    transport: "stdio",
    tools: ["grape_get_context", "grape_get_artifact", "grape_get_omitted_item", "grape_get_status"],
    note: "Run grape mcp --stdio --repo <repo-root> to serve Grape context over MCP stdio."
  };
}
