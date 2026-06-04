import type {
  ListLocalConflictsResult,
  LocalConflictSummary,
  ResolveLocalConflictResult
} from "../../app/local-project/index.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { exitCodes } from "../exit-codes.js";
import { errorMessage, repoOutputOptions, write, writeError, writeJson } from "../render.js";

export async function runConflicts(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--json", "--repo", "--resolve", "--as"]));
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }

  try {
    const rootPath = repoPath(parsed);
    const outputOptions = repoOutputOptions(rootPath);
    if (parsed.values.has("--resolve")) {
      const { resolveLocalConflict } = await import("../../app/local-project/inspection/conflicts.js");
      const resolution = parseConflictResolution(parsed.values.get("--as"));
      const result = resolveLocalConflict({
        rootPath,
        edgeId: parsed.values.get("--resolve") ?? "",
        resolution
      });

      if (parsed.flags.has("--json")) {
        writeJson(result, outputOptions);
        return exitCodes.ok;
      }

      write(renderConflictResolution(result), outputOptions);
      return exitCodes.ok;
    }

    const { listLocalConflicts } = await import("../../app/local-project/inspection/conflicts.js");
    const result = listLocalConflicts({ rootPath });

    if (parsed.flags.has("--json")) {
      writeJson(result, outputOptions);
      return exitCodes.ok;
    }

    write(renderConflicts(result), outputOptions);
    return exitCodes.ok;
  } catch (error) {
    writeError(`grape conflicts failed: ${errorMessage(error)}`, repoOutputOptions(repoPath(parsed)));
    return conflictsErrorExitCode(error);
  }
}

function parseConflictResolution(value: string | undefined): "coexists_with" | "variant_of" {
  if (value === "coexists_with" || value === "variant_of") return value;
  throw new Error("--as must be one of: coexists_with, variant_of");
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

function renderConflictResolution(result: ResolveLocalConflictResult): string {
  return [
    `Resolved conflict: ${result.edgeId}`,
    `Resolution: ${result.resolution}`,
    `Resolution edge: ${result.resolutionEdgeId}`
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
