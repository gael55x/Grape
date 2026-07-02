import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { mcpServerConfig } from "./mcp-guide.js";
import type { McpServerConfig } from "./setup-types.js";

export type McpInstallClient = "cursor" | "claude" | "codex" | "generic";
export type McpInstallStatus = "created" | "updated" | "already_configured" | "dry_run" | "manual";
export type McpInstallChange = "create" | "update" | "none";

export const unsupportedAutoInstallMessage =
  "Auto-install is currently supported for Cursor, Claude Desktop, Codex, or a generic JSON config path. Use `grape mcp --install --client generic --config-path <file>` or `grape mcp --print-config` for manual setup.";

export class McpClientConfigInstallError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unsupported_client"
      | "unsupported_path"
      | "invalid_json"
      | "invalid_config_shape"
      | "conflicting_grape_entry"
  ) {
    super(message);
    this.name = "McpClientConfigInstallError";
  }
}

export interface McpClientConfigInstallInput {
  readonly rootPath: string;
  readonly client: McpInstallClient;
  readonly dryRun?: boolean;
  readonly force?: boolean;
  readonly configPath?: string;
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
  readonly homeDir?: string;
  readonly claudeConfigPath?: string;
  readonly codexConfigPath?: string;
}

export interface ClaudeConfigPathInput {
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
  readonly homeDir?: string;
}

export type ClaudeConfigPathResult =
  | {
      readonly status: "resolved";
      readonly configPath: string;
    }
  | {
      readonly status: "unsupported";
      readonly reason: string;
      readonly recoveryGuidance: string;
    };

export interface McpClientConfigInstallResult {
  readonly client: McpInstallClient;
  readonly clientLabel: string;
  readonly targetPath: string;
  readonly serverName: "grape";
  readonly serverConfig: McpServerConfig;
  readonly finalConfig: Record<string, unknown> | string;
  readonly finalConfigText?: string;
  readonly configFormat: "json" | "toml";
  readonly fallbackCommand?: string;
  readonly targetExisted: boolean;
  readonly dryRun: boolean;
  readonly wrote: boolean;
  readonly status: McpInstallStatus;
  readonly change: McpInstallChange;
}

export function installMcpClientConfig(
  input: McpClientConfigInstallInput
): McpClientConfigInstallResult {
  const rootPath = path.resolve(input.rootPath);
  const targetPath = resolveMcpClientConfigPath(input.client, {
    rootPath,
    configPath: input.configPath,
    platform: input.platform,
    env: input.env,
    homeDir: input.homeDir,
    claudeConfigPath: input.claudeConfigPath,
    codexConfigPath: input.codexConfigPath
  });
  const serverConfig = mcpServerConfig(rootPath);
  if (input.client === "generic" && !targetPath) {
    return genericManualConfig({ rootPath, serverConfig, dryRun: input.dryRun === true });
  }
  if (!targetPath) {
    throw new McpClientConfigInstallError(unsupportedAutoInstallMessage, "unsupported_path");
  }
  if (input.client === "codex") {
    return installCodexClientConfig({
      rootPath,
      targetPath,
      serverConfig,
      dryRun: input.dryRun === true,
      force: input.force === true
    });
  }

  const existing = readClientConfig(targetPath, input.client);
  const merged = mergeGrapeServerConfig({
    existingConfig: existing.config,
    targetPath,
    client: input.client,
    serverConfig,
    force: input.force === true
  });
  const dryRun = input.dryRun === true;

  if (!dryRun && merged.change !== "none") {
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, `${JSON.stringify(merged.finalConfig, null, 2)}\n`);
  }

  return {
    client: input.client,
    clientLabel: clientLabel(input.client),
    targetPath,
    serverName: "grape",
    serverConfig,
    finalConfig: merged.finalConfig,
    configFormat: "json",
    targetExisted: existing.existed,
    dryRun,
    wrote: !dryRun && merged.change !== "none",
    status: dryRun ? "dry_run" : merged.change === "none" ? "already_configured" : existing.existed ? "updated" : "created",
    change: merged.change
  };
}

export function resolveClaudeDesktopConfigPath(
  input: ClaudeConfigPathInput = {}
): ClaudeConfigPathResult {
  const platform = input.platform ?? process.platform;
  const env = input.env ?? process.env;

  if (platform === "darwin") {
    const home = firstNonEmpty(input.homeDir, env.HOME, os.homedir());
    if (!home) return unsupportedClaudePath("macOS home directory could not be resolved.");
    return {
      status: "resolved",
      configPath: path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
    };
  }

  if (platform === "win32") {
    const appData = firstNonEmpty(env.APPDATA);
    if (!appData) return unsupportedClaudePath("APPDATA is not set.");
    return {
      status: "resolved",
      configPath: path.join(appData, "Claude", "claude_desktop_config.json")
    };
  }

  if (platform === "linux") {
    const home = firstNonEmpty(input.homeDir, env.HOME, os.homedir());
    const configHome = firstNonEmpty(env.XDG_CONFIG_HOME, home ? path.join(home, ".config") : undefined);
    if (!configHome) return unsupportedClaudePath("XDG_CONFIG_HOME and HOME could not be resolved.");
    return {
      status: "resolved",
      configPath: path.join(configHome, "Claude", "claude_desktop_config.json")
    };
  }

  return unsupportedClaudePath(`platform ${platform} is not supported for Claude Desktop auto-install.`);
}

interface ResolveConfigPathInput extends ClaudeConfigPathInput {
  readonly rootPath: string;
  readonly configPath?: string;
  readonly claudeConfigPath?: string;
  readonly codexConfigPath?: string;
}

function resolveMcpClientConfigPath(client: McpInstallClient, input: ResolveConfigPathInput): string | undefined {
  if (input.configPath) return path.resolve(input.rootPath, input.configPath);
  if (client === "cursor") return path.join(input.rootPath, ".cursor", "mcp.json");
  if (client === "codex") return input.codexConfigPath ?? path.join(input.rootPath, ".codex", "config.toml");
  if (client === "generic") return undefined;

  const resolved = input.claudeConfigPath
    ? { status: "resolved" as const, configPath: input.claudeConfigPath }
    : resolveClaudeDesktopConfigPath(input);
  if (resolved.status === "resolved") return resolved.configPath;

  throw new McpClientConfigInstallError(
    `Could not resolve Claude Desktop config path: ${resolved.reason} ${resolved.recoveryGuidance}`,
    "unsupported_path"
  );
}

interface ExistingConfig {
  readonly existed: boolean;
  readonly config: Record<string, unknown>;
}

function readClientConfig(targetPath: string, client: McpInstallClient): ExistingConfig {
  if (!existsSync(targetPath)) return { existed: false, config: {} };

  const raw = readFileSync(targetPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new McpClientConfigInstallError(
      `Existing ${clientLabel(client)} MCP config contains invalid JSON at ${targetPath}: ${detail}. Fix or move this file, then rerun grape mcp --install --client ${client}.`,
      "invalid_json"
    );
  }

  if (!isRecord(parsed)) {
    throw new McpClientConfigInstallError(
      `Existing ${clientLabel(client)} MCP config at ${targetPath} must be a JSON object. Use grape mcp --print-config for manual setup.`,
      "invalid_config_shape"
    );
  }

  return { existed: true, config: parsed };
}

interface MergeInput {
  readonly existingConfig: Record<string, unknown>;
  readonly targetPath: string;
  readonly client: McpInstallClient;
  readonly serverConfig: McpServerConfig;
  readonly force: boolean;
}

interface MergeResult {
  readonly finalConfig: Record<string, unknown>;
  readonly change: McpInstallChange;
}

function mergeGrapeServerConfig(input: MergeInput): MergeResult {
  const rawServers = input.existingConfig.mcpServers;
  if (rawServers !== undefined && !isRecord(rawServers)) {
    throw new McpClientConfigInstallError(
      `Existing ${clientLabel(input.client)} MCP config at ${input.targetPath} has a non-object mcpServers value. Grape will not overwrite it automatically. Use grape mcp --print-config for manual setup.`,
      "invalid_config_shape"
    );
  }

  const mcpServers = rawServers ?? {};
  const existingGrape = mcpServers.grape;

  if (existingGrape !== undefined) {
    if (deepEqual(existingGrape, input.serverConfig)) {
      return { finalConfig: input.existingConfig, change: "none" };
    }
    if (!input.force) {
      throw new McpClientConfigInstallError(
        `Existing Grape MCP server entry in ${input.targetPath} differs from the current config. Re-run with --force to replace only mcpServers.grape, or use grape mcp --print-config for manual setup.`,
        "conflicting_grape_entry"
      );
    }
  }

  return {
    finalConfig: {
      ...input.existingConfig,
      mcpServers: {
        ...mcpServers,
        grape: input.serverConfig
      }
    },
    change: existingGrape === undefined && rawServers === undefined ? "create" : "update"
  };
}

function unsupportedClaudePath(reason: string): ClaudeConfigPathResult {
  return {
    status: "unsupported",
    reason,
    recoveryGuidance: "Use `grape mcp --print-config` for manual setup."
  };
}

function clientLabel(client: McpInstallClient): string {
  if (client === "cursor") return "Cursor";
  if (client === "claude") return "Claude Desktop";
  if (client === "generic") return "Generic MCP client";
  return "Codex";
}

function genericManualConfig(input: {
  readonly rootPath: string;
  readonly serverConfig: McpServerConfig;
  readonly dryRun: boolean;
}): McpClientConfigInstallResult {
  return {
    client: "generic",
    clientLabel: "Generic MCP client",
    targetPath: "manual MCP client config",
    serverName: "grape",
    serverConfig: input.serverConfig,
    finalConfig: { mcpServers: { grape: input.serverConfig } },
    configFormat: "json",
    targetExisted: false,
    dryRun: input.dryRun,
    wrote: false,
    status: input.dryRun ? "dry_run" : "manual",
    change: "none"
  };
}

interface InstallCodexInput {
  readonly rootPath: string;
  readonly targetPath: string;
  readonly serverConfig: McpServerConfig;
  readonly dryRun: boolean;
  readonly force: boolean;
}

function installCodexClientConfig(input: InstallCodexInput): McpClientConfigInstallResult {
  const targetExisted = existsSync(input.targetPath);
  const existingText = targetExisted ? readFileSync(input.targetPath, "utf8") : "";
  validateConservativeCodexToml(existingText, input.targetPath, input.serverConfig);
  const merged = mergeCodexGrapeServerConfig({
    existingText,
    targetPath: input.targetPath,
    serverConfig: input.serverConfig,
    force: input.force
  });

  if (!input.dryRun && merged.change !== "none") {
    mkdirSync(path.dirname(input.targetPath), { recursive: true });
    writeFileSync(input.targetPath, merged.finalText);
  }

  return {
    client: "codex",
    clientLabel: "Codex",
    targetPath: input.targetPath,
    serverName: "grape",
    serverConfig: input.serverConfig,
    finalConfig: merged.finalText,
    finalConfigText: merged.finalText,
    configFormat: "toml",
    fallbackCommand: codexMcpAddCommand(input.serverConfig),
    targetExisted,
    dryRun: input.dryRun,
    wrote: !input.dryRun && merged.change !== "none",
    status: input.dryRun ? "dry_run" : merged.change === "none" ? "already_configured" : targetExisted ? "updated" : "created",
    change: merged.change
  };
}

interface MergeCodexInput {
  readonly existingText: string;
  readonly targetPath: string;
  readonly serverConfig: McpServerConfig;
  readonly force: boolean;
}

interface MergeCodexResult {
  readonly finalText: string;
  readonly change: McpInstallChange;
}

function mergeCodexGrapeServerConfig(input: MergeCodexInput): MergeCodexResult {
  const block = renderCodexMcpServerToml(input.serverConfig);
  const existing = input.existingText;
  if (existing.trim() === "") return { finalText: block, change: "create" };

  const match = findCodexGrapeServerBlock(existing);
  if (!match) return { finalText: appendTomlBlock(existing, block), change: "update" };

  const currentBlock = existing.slice(match.start, match.end);
  if (normalizeTomlBlock(currentBlock) === normalizeTomlBlock(block)) {
    return { finalText: existing, change: "none" };
  }

  if (!input.force) {
    throw new McpClientConfigInstallError(
      `Existing Grape MCP server entry in ${input.targetPath} differs from the current Codex config. Re-run with --force to replace only [mcp_servers.grape], or run ${codexMcpAddCommand(input.serverConfig)} manually after reviewing your Codex config.`,
      "conflicting_grape_entry"
    );
  }

  return {
    finalText: `${existing.slice(0, match.start)}${block}${existing.slice(match.end)}`,
    change: "update"
  };
}

function validateConservativeCodexToml(text: string, targetPath: string, serverConfig: McpServerConfig): void {
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("[")) continue;
    if (!/^\[+[^\]\r\n]+\]+[ \t]*(?:#.*)?$/.test(trimmed)) {
      throw new McpClientConfigInstallError(
        `Existing Codex config at ${targetPath} has a malformed TOML table header on line ${index + 1}. Grape will not modify it automatically. Run ${codexMcpAddCommand(serverConfig)} after fixing the file, or use grape mcp --print-config for manual setup.`,
        "invalid_config_shape"
      );
    }
  }
}

interface TomlBlockMatch {
  readonly start: number;
  readonly end: number;
}

function findCodexGrapeServerBlock(text: string): TomlBlockMatch | undefined {
  const headerPattern = /^[ \t]*\[([^\]\r\n]+)\][ \t]*(?:#.*)?$/gm;
  const headers: { readonly name: string; readonly start: number }[] = [];
  let header: RegExpExecArray | null;
  while ((header = headerPattern.exec(text)) !== null) {
    headers.push({ name: normalizeTomlTableName(header[1]), start: header.index });
  }

  const exactHeaders = headers.filter((item) => item.name === "mcp_servers.grape");
  if (exactHeaders.length > 1) {
    throw new McpClientConfigInstallError(
      "Existing Codex config contains multiple [mcp_servers.grape] tables. Grape will not guess which one to replace. Use grape mcp --print-config or codex mcp add for manual setup.",
      "invalid_config_shape"
    );
  }
  if (exactHeaders.length === 0) return undefined;

  const start = exactHeaders[0].start;
  const following = headers.find((item) => item.start > start && !isCodexGrapeTable(item.name));
  return { start, end: following?.start ?? text.length };
}

function isCodexGrapeTable(name: string): boolean {
  return name === "mcp_servers.grape" || name.startsWith("mcp_servers.grape.");
}

function normalizeTomlTableName(raw: string): string {
  return raw.trim().replace(/\s+/g, "").replace(/"grape"/g, "grape").replace(/'grape'/g, "grape");
}

function renderCodexMcpServerToml(serverConfig: McpServerConfig): string {
  return [
    "[mcp_servers.grape]",
    `command = ${tomlString(serverConfig.command)}`,
    `args = ${tomlArray(serverConfig.args)}`,
    `cwd = ${tomlString(serverConfig.cwd)}`,
    ""
  ].join("\n");
}

function appendTomlBlock(existingText: string, block: string): string {
  const separator = existingText.endsWith("\n\n") ? "" : existingText.endsWith("\n") ? "\n" : "\n\n";
  return `${existingText}${separator}${block}`;
}

function normalizeTomlBlock(value: string): string {
  return value.trim().replace(/\r\n/g, "\n");
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function tomlArray(values: readonly string[]): string {
  return `[${values.map(tomlString).join(", ")}]`;
}

function codexMcpAddCommand(serverConfig: McpServerConfig): string {
  return `codex mcp add grape -- ${serverConfig.command} ${serverConfig.args.map(shellQuote).join(" ")}`;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=,@%+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (!deepEqual(leftKeys, rightKeys)) return false;
    return leftKeys.every((key) => deepEqual(left[key], right[key]));
  }
  return false;
}

function firstNonEmpty(...values: readonly (string | undefined)[]): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
