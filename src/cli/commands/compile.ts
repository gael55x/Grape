import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";

export async function runCompile(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(
    parsed,
    new Set(["--json", "--repo", "--task", "--task-type", "--risk", "--session", "--reset-session"])
  );
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }

  const task = parsed.values.get("--task");
  if (!task) {
    writeError("grape compile requires --task <text>");
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
      resetSession: parsed.flags.has("--reset-session")
    });

    if (parsed.flags.has("--json")) {
      writeJson(result);
      return result.unsafeReasons.length === 0 ? exitCodes.ok : exitCodes.unsafe;
    }

    write([
      "Grape context compiled.",
      "",
      `Session: ${result.sessionId}`,
      `Artifact: ${result.artifactId}`,
      `Branch: ${result.branch}`,
      `Head: ${result.headCommit}`,
      `Worktree: ${result.dirtyWorktree ? "dirty" : "clean"}`,
      `Pack items: ${result.contextPackItems.length}`,
      `Sent items: ${result.sentItemCount}`,
      `Omitted unchanged: ${result.omittedItemCount}`,
      result.sessionResetId ? `Session reset: ${result.sessionResetId}` : undefined,
      `Warnings: ${result.warnings.length === 0 ? "none" : result.warnings.join(", ")}`,
      "",
      "Files:",
      `  JSON: ${result.artifactJsonPath}`,
      `  Markdown: ${result.artifactMarkdownPath}`
    ].filter((line): line is string => line !== undefined).join("\n"));

    return result.unsafeReasons.length === 0 ? exitCodes.ok : exitCodes.unsafe;
  } catch (error) {
    writeError(`grape compile failed: ${errorMessage(error)}`);
    return compileErrorExitCode(error);
  }
}

function compileErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.startsWith("unsupported task type") || message.startsWith("unsupported risk overlay")) {
    return exitCodes.usage;
  }
  if (message.includes("may only contain letters")) return exitCodes.usage;
  if (message.includes("secret scan blocked")) return exitCodes.unsafe;
  if (message.includes("session is locked")) return exitCodes.lock;
  if (message.includes("config root path does not match")) return exitCodes.stale;
  return exitCodes.storage;
}
