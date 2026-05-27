import type { ListLocalConflictsResult, LocalConflictSummary } from "../../app/local-project/index.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { exitCodes } from "../exit-codes.js";
import { errorMessage, write, writeError, writeJson } from "../render.js";

export async function runConflicts(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--json", "--repo"]));
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }

  try {
    const { listLocalConflicts } = await import("../../app/local-project/conflicts.js");
    const result = listLocalConflicts({ rootPath: repoPath(parsed) });

    if (parsed.flags.has("--json")) {
      writeJson(result);
      return exitCodes.ok;
    }

    write(renderConflicts(result));
    return exitCodes.ok;
  } catch (error) {
    writeError(`grape conflicts failed: ${errorMessage(error)}`);
    return conflictsErrorExitCode(error);
  }
}

function renderConflicts(result: ListLocalConflictsResult): string {
  return [
    `Conflicts: ${result.conflicts.length}`,
    `Branch: ${result.branch}`,
    result.warnings.length > 0 ? `Warnings: ${result.warnings.join(", ")}` : "Warnings: none",
    "",
    ...result.conflicts.map(renderConflict)
  ].join("\n");
}

function renderConflict(conflict: LocalConflictSummary): string {
  return [
    `${conflict.edgeId}  ${conflict.edgeType}`,
    `  Source: ${renderClaim(conflict.sourceClaimId, conflict.sourceClaim)}`,
    `  Target: ${renderClaim(conflict.targetClaimId, conflict.targetClaim)}`,
    `  Created: ${conflict.createdAt}`
  ].join("\n");
}

function renderClaim(
  claimId: string,
  claim: LocalConflictSummary["sourceClaim"] | LocalConflictSummary["targetClaim"]
): string {
  if (!claim) return `${claimId} (missing)`;
  return `${claim.claimId} ${claim.claimType} ${claim.verificationStatus} - ${claim.subject}`;
}

function conflictsErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.includes("config root path does not match")) return exitCodes.stale;
  if (message.includes("config is missing")) return exitCodes.stale;
  return exitCodes.storage;
}
