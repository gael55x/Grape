import type { ListLocalStaleItemsResult, LocalStaleItemSummary } from "../../app/local-project/index.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { exitCodes } from "../exit-codes.js";
import { errorMessage, write, writeError, writeJson } from "../render.js";

export async function runStale(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--json", "--repo", "--session"]));
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }

  try {
    const { listLocalStaleItems } = await import("../../app/local-project/inspection/stale.js");
    const result = listLocalStaleItems({
      rootPath: repoPath(parsed),
      sessionId: parsed.values.get("--session")
    });

    if (parsed.flags.has("--json")) {
      writeJson(result);
      return exitCodes.ok;
    }

    write(renderStaleItems(result));
    return exitCodes.ok;
  } catch (error) {
    writeError(`grape stale failed: ${errorMessage(error)}`);
    return staleErrorExitCode(error);
  }
}

function renderStaleItems(result: ListLocalStaleItemsResult): string {
  const filter = result.sessionId ? ` (session=${result.sessionId})` : "";
  return [
    `Stale context items: ${result.staleItems.length}${filter}`,
    `Sessions inspected: ${result.inspectedSessionCount}`,
    "",
    ...result.staleItems.map(renderStaleItem)
  ].join("\n");
}

function renderStaleItem(item: LocalStaleItemSummary): string {
  return [
    `${item.staleItemId}  ${item.staleReason}`,
    `  Session: ${item.sessionId}`,
    `  Invalidates: ${item.invalidatesSentItemId}`,
    `  Previous: ${renderPreviousContext(item)}`,
    `  Current artifact: ${item.artifactId}`,
    `  Dependencies: ${item.dependencyRefs.length}`
  ].join("\n");
}

function renderPreviousContext(item: LocalStaleItemSummary): string {
  const branch = item.previousBranchName ?? "unknown-branch";
  const commit = item.previousCommitSha ?? "unknown-head";
  const section = item.previousSectionId ?? item.sectionId ?? "unknown-section";
  return `${branch} @ ${commit} (${section})`;
}

function staleErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.includes("config root path does not match")) return exitCodes.stale;
  if (message.includes("config is missing")) return exitCodes.stale;
  return exitCodes.storage;
}
