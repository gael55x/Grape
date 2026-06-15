import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, repoOutputOptions, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";

export async function runSessions(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--json", "--repo"]));
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }

  try {
    const rootPath = repoPath(parsed);
    const outputOptions = repoOutputOptions(rootPath);
    const { listLocalSessions } = await import("../../app/local-project/inspection/sessions.js");
    const result = listLocalSessions({ rootPath });
    if (parsed.flags.has("--json")) {
      writeJson(result, outputOptions);
      return exitCodes.ok;
    }

    const emptyHint = result.sessions.length === 0
      ? [
          "Run grape compile --task \"<task>\" --session <id>, or use MCP grape_get_context with a stable sessionId."
        ]
      : [];
    write([
      `Context sessions: ${result.sessions.length}`,
      "",
      ...result.sessions.map((session) =>
        [
          `${session.sessionId}  ${session.status}/${session.lockStatus}`,
          `  Task: ${session.taskType ?? "unknown"} ${session.taskId ?? ""}`.trimEnd(),
          `  Branch: ${session.branchName} @ ${session.headCommitSha}`,
          [
            `Artifacts: ${session.artifactCount}`,
            `Sent: ${session.sentItemCount}`,
            `Omitted: ${session.omittedItemCount}`,
            `Pack items: ${session.packItemCount}`,
            `Events: ${session.eventCount}`
          ].join("  "),
          `  Updated: ${session.updatedAt}`,
          session.lastEventReason ? `  Last event: ${session.lastEventReason}` : undefined
        ].filter((line): line is string => Boolean(line)).join("\n")
      ),
      ...emptyHint
    ].join("\n"), outputOptions);
    return exitCodes.ok;
  } catch (error) {
    writeError(`grape sessions failed: ${errorMessage(error)}`, repoOutputOptions(repoPath(parsed)));
    return sessionsErrorExitCode(error);
  }
}

function sessionsErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.includes("config root path does not match")) return exitCodes.stale;
  if (message.includes("config is missing")) return exitCodes.stale;
  return exitCodes.storage;
}
