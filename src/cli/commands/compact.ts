import type { CompactLocalProjectResult } from "../../app/local-project/index.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, formatCommandFailure, repoOutputOptions, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";

export async function runCompact(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--json", "--repo", "--dry-run", "--confirm"]));
  if (flag) {
    writeError(`Unsupported option for grape compact: ${flag}`);
    return exitCodes.usage;
  }

  if (parsed.flags.has("--dry-run") && parsed.flags.has("--confirm")) {
    writeError("Choose either --dry-run or --confirm, not both.");
    return exitCodes.usage;
  }

  try {
    const rootPath = repoPath(parsed);
    const { compactLocalProject } = await import("../../app/local-project/maintenance/index.js");
    const result = compactLocalProject({
      rootPath,
      dryRun: parsed.flags.has("--dry-run"),
      confirm: parsed.flags.has("--confirm")
    });
    const outputOptions = repoOutputOptions(rootPath, [result.rootPath]);

    if (parsed.flags.has("--json")) {
      writeJson(result, outputOptions);
      return exitCodes.ok;
    }

    write(renderCompactResult(result), outputOptions);
    return exitCodes.ok;
  } catch (error) {
    const { recoveryGuidanceForErrorMessage } = await import("../../app/local-project/setup/recovery.js");
    writeError(
      formatCommandFailure("compact", error, recoveryGuidanceForErrorMessage(errorMessage(error))),
      repoOutputOptions(repoPath(parsed))
    );
    return exitCodes.storage;
  }
}

function renderCompactResult(result: CompactLocalProjectResult): string {
  const artifactFiles = result.contextArtifacts.artifactFiles;
  const rows = result.contextArtifacts.rowCounts;
  const protectedReasons = result.contextArtifacts.protectedByReason;
  return [
    result.applied ? "Grape compact applied." : "Grape compact preview.",
    "",
    `Database: ${result.databasePath}`,
    `Migrations applied: ${result.migrationsApplied.length === 0 ? "none" : result.migrationsApplied.join(", ")}`,
    "",
    "Retention:",
    `  Context artifacts: ${result.retention.contextArtifacts.maxAgeDays} days, ${result.retention.contextArtifacts.maxRows} rows`,
    `  Cutoff: ${result.contextArtifacts.cutoff}`,
    "",
    "Context artifacts:",
    `  Stored: ${result.contextArtifacts.totalArtifacts}`,
    `  Matched retention: ${result.contextArtifacts.retentionMatchedArtifacts}`,
    `  Eligible to delete: ${result.contextArtifacts.candidateArtifacts}`,
    `  Deleted: ${result.contextArtifacts.deletedArtifacts}`,
    `  Protected: ${result.contextArtifacts.protectedArtifacts}`,
    `  Protected reasons: latest=${protectedReasons.latest_per_session ?? 0}, active=${protectedReasons.active_sent_context ?? 0}, restorable=${protectedReasons.restorable_omitted_context ?? 0}, locked=${protectedReasons.locked_session ?? 0}`,
    "",
    "Rows covered by this plan:",
    `  context_artifacts: ${rows.contextArtifacts}`,
    `  context_dependencies: ${rows.contextDependencies}`,
    `  context_sent_items: ${rows.contextSentItems}`,
    `  omitted_context_items: ${rows.omittedContextItems}`,
    `  context_pack_items: ${rows.contextPackItems}`,
    "",
    "Artifact files:",
    `  Planned files: ${artifactFiles.plannedFiles}`,
    `  Planned bytes: ${artifactFiles.plannedBytes}`,
    `  Deleted files: ${artifactFiles.deletedFiles}`,
    `  Deleted bytes: ${artifactFiles.deletedBytes}`,
    `  Skipped missing files: ${artifactFiles.skippedMissingFiles}`,
    `  Skipped unsafe files: ${artifactFiles.skippedUnsafeFiles}`,
    "",
    "Notes:",
    ...result.notes.map((note) => `  - ${note}`)
  ].join("\n");
}
