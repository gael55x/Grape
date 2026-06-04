import { recoveryGuidanceForErrorMessage } from "../../app/local-project/setup/recovery.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, renderProblems, repoOutputOptions, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";

export async function runOmitted(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--json", "--repo", "--session", "--token"]));
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }

  const sessionId = parsed.values.get("--session");
  if (!sessionId) {
    writeError("grape omitted requires --session <id>");
    return exitCodes.usage;
  }

  try {
    const rootPath = repoPath(parsed);
    const outputOptions = repoOutputOptions(rootPath);
    const token = parsed.values.get("--token");
    if (token) {
      return await runRestoreOmitted(parsed, sessionId, token, rootPath, outputOptions);
    }

    const { listOmittedContext } = await import("../../app/local-project/omission/omitted.js");
    const result = listOmittedContext({ rootPath, sessionId });
    if (parsed.flags.has("--json")) {
      writeJson(result, outputOptions);
      return exitCodes.ok;
    }

    write([
      `Omitted context for session ${result.sessionId}: ${result.omittedItems.length}`,
      "",
      ...result.omittedItems.map(
        (item) => `${item.restoreId}  ${item.sectionId}  ${item.reasonOmitted}  ${item.tokenCount} tokens`
      )
    ].join("\n"), outputOptions);
    return exitCodes.ok;
  } catch (error) {
    const message = errorMessage(error);
    const outputOptions = repoOutputOptions(repoPath(parsed));
    writeError(`grape omitted failed: ${message}`, outputOptions);
    const guidance = recoveryGuidanceForErrorMessage(message);
    if (guidance.length > 0) writeError(renderProblems("Recovery", guidance).join("\n"), outputOptions);
    return omittedErrorExitCode(error);
  }
}

async function runRestoreOmitted(
  parsed: ParsedArgs,
  sessionId: string,
  token: string,
  rootPath: string,
  outputOptions: ReturnType<typeof repoOutputOptions>
): Promise<number> {
  const { restoreOmittedContext } = await import("../../app/local-project/omission/omitted.js");
  const result = restoreOmittedContext({
    rootPath,
    sessionId,
    restoreToken: token
  });
  if (parsed.flags.has("--json")) {
    writeJson(result, outputOptions);
    return result.status === "restored" ? exitCodes.ok : exitCodes.stale;
  }

  if (result.status === "stale") {
    write([
      "Omitted context is stale.",
      "",
      `Session: ${result.sessionId}`,
      `Artifact: ${result.artifactId}`,
      `Section: ${result.sectionId}`,
      `Reason: ${result.reason}`,
      ...renderProblems("Recovery", ["Rerun grape compile for fresh context, or inspect stale entries with grape stale."])
    ].join("\n"), outputOptions);
    return exitCodes.stale;
  }

  write([
    `# ${result.title}`,
    "",
    `Session: ${result.sessionId}`,
    `Artifact: ${result.artifactId}`,
    `Section: ${result.sectionId}`,
    `Content hash: ${result.contentHash}`,
    "",
    result.body
  ].join("\n"), outputOptions);
  return exitCodes.ok;
}

function omittedErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.includes("requires --session")) return exitCodes.usage;
  if (message.includes("not found")) return exitCodes.usage;
  if (message.includes("stale")) return exitCodes.stale;
  if (message.includes("secret")) return exitCodes.unsafe;
  if (message.includes("config root path does not match")) return exitCodes.stale;
  return exitCodes.storage;
}
