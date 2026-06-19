import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, repoOutputOptions, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";

export async function runMcp(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--print-config", "--stdio", "--install", "--repo", "--dry-run", "--force"]));
  if (flag) {
    writeError(`Unsupported option for grape mcp: ${flag}`);
    writeError("Run grape help for supported options.");
    return exitCodes.usage;
  }

  const actionCount = [parsed.flags.has("--print-config"), parsed.flags.has("--stdio"), parsed.flags.has("--install")]
    .filter(Boolean).length;
  if (actionCount > 1) {
    writeError("Choose only one MCP action: --print-config, --install, or --stdio.");
    return exitCodes.usage;
  }

  if ((parsed.flags.has("--dry-run") || parsed.flags.has("--force") || parsed.values.has("--client")) && !parsed.flags.has("--install")) {
    writeError("MCP client install options require grape mcp --install.");
    return exitCodes.usage;
  }

  if (parsed.flags.has("--print-config")) {
    const { mcpConnectionGuide } = await import("../../app/local-project/setup/mcp-guide.js");
    const rootPath = repoPath(parsed);
    writeJson({
      grapeMcp: mcpConnectionGuide(rootPath)
    }, repoOutputOptions(rootPath));
    return exitCodes.ok;
  }

  if (parsed.flags.has("--install")) {
    return runMcpInstall(parsed);
  }

  if (parsed.flags.has("--stdio")) {
    const { runStdioMcpServer } = await import("../../mcp/index.js");
    return runStdioMcpServer({ rootPath: repoPath(parsed) });
  }

  write([
    "Grape MCP",
    "",
    "Available now:",
    "  grape mcp --install --client cursor",
    "  grape mcp --install --client claude",
    "  grape mcp --install --client codex",
    "  grape mcp --print-config",
    "  grape mcp --stdio",
    "",
    "Most users should run grape mcp --install --client cursor, grape mcp --install --client claude, or grape mcp --install --client codex.",
    "Use grape mcp --print-config when your MCP client is not supported by auto-install.",
    "Then use the coding agent normally. The agent should call grape_get_context each turn with a stable sessionId.",
    "",
    "Tools:",
    "  grape_get_context",
    "  grape_get_artifact",
    "  grape_get_claims",
    "  grape_get_proofs",
    "  grape_get_rules",
    "  grape_get_omitted_item",
    "  grape_get_stale_items",
    "  grape_get_conflicts",
    "  grape_get_status",
    "  grape_record_candidate",
    "  grape_record_command_result",
    "  grape_record_test_result",
    "  grape_record_user_decision",
    "  grape_request_user_confirmation",
    "",
    "Next:",
    "  grape mcp --install --client cursor",
    "  grape mcp --install --client claude",
    "  grape mcp --install --client codex",
    "  grape mcp --print-config",
    "  grape status",
    "  grape doctor"
  ].join("\n"));
  return exitCodes.ok;
}

async function runMcpInstall(parsed: ParsedArgs): Promise<number> {
  const rootPath = repoPath(parsed);
  const client = parsed.values.get("--client");
  const {
    installMcpClientConfig,
    unsupportedAutoInstallMessage,
    McpClientConfigInstallError
  } = await import("../../app/local-project/setup/mcp-client-config.js");

  if (client !== "cursor" && client !== "claude" && client !== "codex") {
    writeError(client ? unsupportedAutoInstallMessage : "grape mcp --install requires --client cursor, --client claude, or --client codex.");
    if (!client) writeError(unsupportedAutoInstallMessage);
    return exitCodes.usage;
  }

  try {
    const result = installMcpClientConfig({
      rootPath,
      client,
      dryRun: parsed.flags.has("--dry-run"),
      force: parsed.flags.has("--force")
    });
    renderMcpInstallResult(result, rootPath);
    return exitCodes.ok;
  } catch (error) {
    const message = error instanceof McpClientConfigInstallError ? error.message : errorMessage(error);
    writeError(`grape mcp --install failed: ${message}`, repoOutputOptions(rootPath));
    return exitCodes.usage;
  }
}

function renderMcpInstallResult(
  result: {
    readonly clientLabel: string;
    readonly targetPath: string;
    readonly serverName: string;
    readonly serverConfig: {
      readonly command: string;
      readonly args: readonly string[];
      readonly cwd: string;
    };
    readonly finalConfig: Record<string, unknown> | string;
    readonly finalConfigText?: string;
    readonly configFormat?: "json" | "toml";
    readonly fallbackCommand?: string;
    readonly status: "created" | "updated" | "already_configured" | "dry_run";
    readonly change: "create" | "update" | "none";
    readonly wrote: boolean;
    readonly dryRun: boolean;
  },
  rootPath: string
): void {
  const statusLine =
    result.status === "dry_run"
      ? "Dry run: no changes written."
      : result.status === "already_configured"
        ? `Grape MCP server already configured for ${result.clientLabel}.`
        : result.status === "created"
          ? `Wrote Grape MCP server config for ${result.clientLabel}.`
          : `Updated Grape MCP server config for ${result.clientLabel}.`;
  const changeLine =
    result.change === "none"
      ? "Change: none"
      : result.change === "create"
        ? "Change: create config entry"
        : "Change: update config entry";

  write([
    statusLine,
    `Client: ${result.clientLabel}`,
    `Target: ${result.targetPath}`,
    `Server entry: ${result.configFormat === "toml" ? `[mcp_servers.${result.serverName}]` : `mcpServers.${result.serverName}`}`,
    `Server command: ${result.serverConfig.command} ${result.serverConfig.args.join(" ")}`,
    `Working directory: ${result.serverConfig.cwd}`,
    changeLine,
    "",
    "Next:",
    `  Restart or reload ${result.clientLabel} so it reads the MCP config.`,
    "  Verify the connection by listing MCP tools or calling grape_get_status.",
    "  Ask the agent to call grape_get_context with a stable sessionId for each continued repo task.",
    result.fallbackCommand ? `  CLI fallback: ${result.fallbackCommand}` : undefined,
    "  Manual fallback: grape mcp --print-config",
    "",
    result.dryRun || result.wrote
      ? result.configFormat === "toml"
        ? "Final TOML:"
        : "Final JSON:"
      : result.configFormat === "toml"
        ? "Existing TOML:"
        : "Existing JSON:",
    result.configFormat === "toml" ? result.finalConfigText ?? String(result.finalConfig) : JSON.stringify(result.finalConfig, null, 2)
  ].filter((line): line is string => line !== undefined).join("\n"), repoOutputOptions(rootPath));
}
