import { recoveryGuidanceForErrorMessage } from "../../app/local-project/recovery.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, renderProblems, write, writeError, writeJson } from "../render.js";
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
    const { compileLocalContext } = await import("../../app/local-project/compile.js");
    const result = compileLocalContext({
      rootPath: repoPath(parsed),
      task,
      taskType: parsed.values.get("--task-type"),
      riskOverlays: parsed.values.get("--risk"),
      sessionId: parsed.values.get("--session"),
      tokenBudget: parseTokenBudget(parsed.values.get("--token-budget")),
      resetSession: parsed.flags.has("--reset-session")
    });

    if (parsed.flags.has("--json")) {
      writeJson(result);
      return result.unsafeReasons.length === 0 ? exitCodes.ok : exitCodes.unsafe;
    }

    write([
      output.successTitle,
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
    ].filter((line): line is string => line !== undefined).join("\n"));

    return result.unsafeReasons.length === 0 ? exitCodes.ok : exitCodes.unsafe;
  } catch (error) {
    const message = errorMessage(error);
    writeError(`grape ${output.commandLabel} failed: ${message}`);
    const guidance = recoveryGuidanceForErrorMessage(message);
    if (guidance.length > 0) writeError(renderProblems("Recovery", guidance).join("\n"));
    return compileErrorExitCode(error);
  }
}

function compileErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.startsWith("unsupported task type") || message.startsWith("unsupported risk overlay")) {
    return exitCodes.usage;
  }
  if (message.startsWith("token budget must")) return exitCodes.usage;
  if (message.includes("may only contain letters")) return exitCodes.usage;
  if (message.includes("secret scan blocked")) return exitCodes.unsafe;
  if (message.includes("session is locked")) return exitCodes.lock;
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
