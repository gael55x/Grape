import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { mcpServerConfig } from "./mcp-guide.js";
import type { McpServerConfig } from "./setup-types.js";

export type McpInstallClient = "cursor" | "claude";
export type McpInstallStatus = "created" | "updated" | "already_configured" | "dry_run";
export type McpInstallChange = "create" | "update" | "none";

export const unsupportedAutoInstallMessage =
  "Auto-install is currently supported for Cursor and Claude Desktop only. Use `grape mcp --print-config` for manual setup.";

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
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
  readonly homeDir?: string;
  readonly claudeConfigPath?: string;
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
  readonly finalConfig: Record<string, unknown>;
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
    platform: input.platform,
    env: input.env,
    homeDir: input.homeDir,
    claudeConfigPath: input.claudeConfigPath
  });
  const serverConfig = mcpServerConfig(rootPath);
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
  readonly claudeConfigPath?: string;
}

function resolveMcpClientConfigPath(client: McpInstallClient, input: ResolveConfigPathInput): string {
  if (client === "cursor") return path.join(input.rootPath, ".cursor", "mcp.json");

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
  return client === "cursor" ? "Cursor" : "Claude Desktop";
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
