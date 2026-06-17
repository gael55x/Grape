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
    "  grape mcp --print-config",
    "  grape mcp --stdio",
    "",
    "Most users should run grape mcp --install --client cursor or grape mcp --install --client claude.",
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

  if (client !== "cursor" && client !== "claude") {
    writeError(client ? unsupportedAutoInstallMessage : "grape mcp --install requires --client cursor or --client claude.");
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
    readonly finalConfig: Record<string, unknown>;
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
    `Target: ${result.targetPath}`,
    `Server entry: mcpServers.${result.serverName}`,
    changeLine,
    "",
    result.dryRun || result.wrote ? "Final JSON:" : "Existing JSON:",
    JSON.stringify(result.finalConfig, null, 2)
  ].join("\n"), repoOutputOptions(rootPath));
}
