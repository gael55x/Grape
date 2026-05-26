import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";

export async function runSessions(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--json", "--repo"]));
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }

  try {
    const { listLocalSessions } = await import("../../app/local-project/sessions.js");
    const result = listLocalSessions({ rootPath: repoPath(parsed) });
    if (parsed.flags.has("--json")) {
      writeJson(result);
      return exitCodes.ok;
    }

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
      )
    ].join("\n"));
    return exitCodes.ok;
  } catch (error) {
    writeError(`grape sessions failed: ${errorMessage(error)}`);
    return sessionsErrorExitCode(error);
  }
}

function sessionsErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.includes("config root path does not match")) return exitCodes.stale;
  if (message.includes("config is missing")) return exitCodes.stale;
  return exitCodes.storage;
}
