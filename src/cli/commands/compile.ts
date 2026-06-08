import { recoveryGuidanceForErrorMessage } from "../../app/local-project/setup/recovery.js";
import { compileSuccessTitle } from "../../shared/trust-wording.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, renderProblems, repoOutputOptions, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";

export async function runCompile(parsed: ParsedArgs): Promise<number> {
  return runCompileLike(parsed, {
    commandLabel: "compile",
    missingTaskMessage: "grape compile requires --task <text>",
    successTitle: "Grape context compiled."
  });
}

export async function runCompileLike(
  parsed: ParsedArgs,
  output: {
    readonly commandLabel: string;
    readonly missingTaskMessage: string;
    readonly successTitle: string;
  }
): Promise<number> {
  const flag = unsupportedFlag(
    parsed,
    new Set([
      "--json",
      "--repo",
      "--task",
      "--task-type",
      "--environment-scope",
      "--feature-flags",
      "--risk",
      "--session",
      "--reset-session",
      "--token-budget"
    ])
  );
  if (flag) {
    writeError(`Unsupported option for grape ${output.commandLabel}: ${flag}`);
    return exitCodes.usage;
  }

  const task = parsed.values.get("--task");
  if (!task) {
    writeError(output.missingTaskMessage);
    return exitCodes.usage;
  }

  try {
    const rootPath = repoPath(parsed);
    const outputOptions = repoOutputOptions(rootPath);
    const { compileLocalContext } = await import("../../app/local-project/context/compile.js");
    const result = compileLocalContext({
      rootPath,
      task,
      taskType: parsed.values.get("--task-type"),
      environmentScope: parseEnvironmentScope(parsed.values.get("--environment-scope")),
      featureFlags: parseFeatureFlags(parsed.values.get("--feature-flags")),
      riskOverlays: parsed.values.get("--risk"),
      sessionId: parsed.values.get("--session"),
      tokenBudget: parseTokenBudget(parsed.values.get("--token-budget")),
      resetSession: parsed.flags.has("--reset-session")
    });

    if (parsed.flags.has("--json")) {
      writeJson(result, outputOptions);
      return result.unsafeReasons.length === 0 ? exitCodes.ok : exitCodes.unsafe;
    }

    write([
      compileSuccessTitle(result.unsafeReasons.length, output.successTitle),
      "",
      `Session: ${result.sessionId}`,
      `Artifact: ${result.artifactId}`,
      `Branch: ${result.branch}`,
      `Head: ${result.headCommit}`,
      `Worktree: ${result.dirtyWorktree ? "dirty" : "clean"}`,
      `Pack items: ${result.contextPackItems.length}`,
      `Sent items: ${result.sentItemCount}`,
      `Omitted unchanged: ${result.omittedItemCount}`,
      result.budget.status !== "not_requested" ? `Token budget: ${result.budget.status}` : undefined,
      result.sessionResetId ? `Session reset: ${result.sessionResetId}` : undefined,
      `Warnings: ${result.warnings.length === 0 ? "none" : result.warnings.join(", ")}`,
      result.databaseBackupPath ? `Database backup: ${result.databaseBackupPath}` : undefined,
      ...renderProblems("Recovery", result.recoveryGuidance),
      "",
      "Files:",
      `  JSON: ${result.artifactJsonPath}`,
      `  Markdown: ${result.artifactMarkdownPath}`
    ].filter((line): line is string => line !== undefined).join("\n"), outputOptions);

    return result.unsafeReasons.length === 0 ? exitCodes.ok : exitCodes.unsafe;
  } catch (error) {
    const message = errorMessage(error);
    const outputOptions = repoOutputOptions(repoPath(parsed));
    writeError(`grape ${output.commandLabel} failed: ${message}`, outputOptions);
    const guidance = recoveryGuidanceForErrorMessage(message);
    if (guidance.length > 0) writeError(renderProblems("Recovery", guidance).join("\n"), outputOptions);
    return compileErrorExitCode(error);
  }
}

function compileErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.startsWith("unsupported task type") || message.startsWith("unsupported risk overlay")) {
    return exitCodes.usage;
  }
  if (message.startsWith("environment scope must")) return exitCodes.usage;
  if (message.startsWith("feature flags must")) return exitCodes.usage;
  if (message.startsWith("token budget must")) return exitCodes.usage;
  if (message.includes("may only contain letters")) return exitCodes.usage;
  if (message.includes("secret scan blocked")) return exitCodes.unsafe;
  if (message.includes("session is locked")) return exitCodes.lock;
  if (message.startsWith("context session task mismatch") || message.startsWith("context session task type mismatch")) {
    return exitCodes.sessionMismatch;
  }
  if (message.includes("config root path does not match")) return exitCodes.stale;
  return exitCodes.storage;
}

function parseTokenBudget(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("token budget must be a positive integer");
  }
  return parsed;
}

function parseEnvironmentScope(
  value: string | undefined
): "local" | "test" | "ci" | "staging" | "production" | "unknown" | undefined {
  if (value === undefined) return undefined;
  const allowed = ["local", "test", "ci", "staging", "production", "unknown"] as const;
  if (!allowed.includes(value as (typeof allowed)[number])) {
    throw new Error("environment scope must be local, test, ci, staging, production, or unknown");
  }
  return value as (typeof allowed)[number];
}

function parseFeatureFlags(value: string | undefined): Readonly<Record<string, string | boolean>> | undefined {
  if (value === undefined) return undefined;
  const flags: Record<string, string | boolean> = {};
  for (const rawEntry of value.split(",")) {
    const entry = rawEntry.trim();
    if (!entry) throw new Error("feature flags must be comma-separated name or name=value entries");
    const [rawName, ...rawValueParts] = entry.split("=");
    const name = rawName.trim();
    if (!safeFeatureFlagName(name) || rawValueParts.length > 1) {
      throw new Error("feature flags must use safe names and optional values");
    }
    const rawFlagValue = rawValueParts[0]?.trim();
    flags[name] = parseFeatureFlagValue(rawFlagValue);
  }
  return Object.keys(flags).length > 0 ? flags : undefined;
}

function parseFeatureFlagValue(value: string | undefined): string | boolean {
  if (value === undefined || value === "") return true;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/[\0\r\n\t]/.test(value) || value.length > 120) {
    throw new Error("feature flags must use safe names and optional values");
  }
  return value;
}

function safeFeatureFlagName(value: string): boolean {
  return /^[A-Za-z0-9_.:-]{1,80}$/.test(value);
}
