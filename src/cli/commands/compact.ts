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
  const compressionRows = result.compressionCache.rowCounts;
  const compressionProtectedReasons = result.compressionCache.protectedByReason;
  const ftsRows = result.ftsIndex.rowCounts;
  const ftsProtectedReasons = result.ftsIndex.protectedByReason;
  const derivedRows = result.derivedMetadata.rowCounts;
  const derivedProtectedReasons = result.derivedMetadata.protectedByReason;
  const snapshotRows = result.snapshots.rowCounts;
  const snapshotProtectedReasons = result.snapshots.protectedByReason;
  const invalidatedRows = result.invalidatedRecords.rowCounts;
  const invalidatedProtectedReasons = result.invalidatedRecords.protectedByReason;
  return [
    result.applied ? "Grape compact applied." : "Grape compact preview.",
    "",
    `Database: ${result.databasePath}`,
    `Migrations applied: ${result.migrationsApplied.length === 0 ? "none" : result.migrationsApplied.join(", ")}`,
    "",
    "Retention:",
    `  Context artifacts: ${result.retention.contextArtifacts.maxAgeDays} days, ${result.retention.contextArtifacts.maxRows} rows`,
    `  Snapshots: ${result.retention.snapshots.maxAgeDays} days, ${result.retention.snapshots.maxRows} rows`,
    `  Compression inputs: ${result.retention.compressionInputs.maxAgeDays} days, ${result.retention.compressionInputs.maxRows} rows`,
    `  FTS rows: ${result.retention.ftsRows.maxAgeDays} days, ${result.retention.ftsRows.maxRows} rows`,
    `  Derived metadata: ${result.retention.derivedMetadata.maxAgeDays} days, ${result.retention.derivedMetadata.maxRows} rows`,
    `  Invalidated records: ${result.retention.invalidatedRecords.maxAgeDays} days, ${result.retention.invalidatedRecords.maxRows} rows`,
    `  Cutoff: ${result.contextArtifacts.cutoff}`,
    "",
    "Context artifacts:",
    `  Stored: ${result.contextArtifacts.totalArtifacts}`,
    `  Matched retention: ${result.contextArtifacts.retentionMatchedArtifacts}`,
    `  Eligible to delete: ${result.contextArtifacts.candidateArtifacts}`,
    `  Deleted: ${result.contextArtifacts.deletedArtifacts}`,
    `  Protected: ${result.contextArtifacts.protectedArtifacts}`,
    `  Protected reasons: latest=${protectedReasons.latest_per_session ?? 0}, active=${protectedReasons.active_sent_context ?? 0}, restorable=${protectedReasons.restorable_omitted_context ?? 0}, locked=${protectedReasons.locked_session ?? 0}, invalidation_marker=${protectedReasons.invalidation_marker ?? 0}`,
    "",
    "Rows covered by this plan:",
    `  context_artifacts: ${rows.contextArtifacts}`,
    `  context_dependencies: ${rows.contextDependencies}`,
    `  context_sent_items: ${rows.contextSentItems}`,
    `  omitted_context_items: ${rows.omittedContextItems}`,
    `  context_pack_items: ${rows.contextPackItems}`,
    "",
    "Compression cache:",
    `  Stored artifacts: ${result.compressionCache.totalArtifacts}`,
    `  Stored input rows: ${result.compressionCache.totalInputRows}`,
    `  Matched retention: ${result.compressionCache.retentionMatchedArtifacts}`,
    `  Eligible to delete: ${result.compressionCache.candidateArtifacts}`,
    `  Deleted artifacts: ${result.compressionCache.deletedArtifacts}`,
    `  Protected artifacts: ${result.compressionCache.protectedArtifacts}`,
    `  Protected reasons: referenced=${compressionProtectedReasons.referenced_by_context_artifact ?? 0}`,
    `  compression_artifacts: ${compressionRows.compressionArtifacts}`,
    `  compression_inputs: ${compressionRows.compressionInputs}`,
    "",
    "FTS index:",
    `  Cutoff: ${result.ftsIndex.cutoff}`,
    `  Snapshots with FTS rows: ${result.ftsIndex.totalSnapshots}`,
    `  Stored FTS rows: ${result.ftsIndex.totalRows}`,
    `  Matched snapshots: ${result.ftsIndex.retentionMatchedSnapshots}`,
    `  Matched rows: ${result.ftsIndex.retentionMatchedRows}`,
    `  Eligible snapshots: ${result.ftsIndex.candidateSnapshots}`,
    `  Eligible rows: ${result.ftsIndex.candidateRows}`,
    `  Deleted rows: ${result.ftsIndex.deletedRows}`,
    `  Protected snapshots: ${result.ftsIndex.protectedSnapshots}`,
    `  Protected rows: ${result.ftsIndex.protectedRows}`,
    `  Protected reasons: latest_snapshot=${ftsProtectedReasons.latest_repo_snapshot ?? 0}`,
    `  fts_entries: ${ftsRows.ftsEntries}`,
    `  fts_entry_text: ${ftsRows.ftsEntryText}`,
    "",
    "Derived metadata:",
    `  Cutoff: ${result.derivedMetadata.cutoff}`,
    `  Snapshots with symbol metadata: ${result.derivedMetadata.totalSnapshots}`,
    `  Stored rows: ${result.derivedMetadata.totalRows}`,
    `  Stored symbol nodes: ${result.derivedMetadata.totalNodeRows}`,
    `  Stored symbol edges: ${result.derivedMetadata.totalEdgeRows}`,
    `  Matched snapshots: ${result.derivedMetadata.retentionMatchedSnapshots}`,
    `  Matched rows: ${result.derivedMetadata.retentionMatchedRows}`,
    `  Eligible snapshots: ${result.derivedMetadata.candidateSnapshots}`,
    `  Eligible rows: ${result.derivedMetadata.candidateRows}`,
    `  Eligible symbol nodes: ${result.derivedMetadata.candidateNodeRows}`,
    `  Eligible symbol edges: ${result.derivedMetadata.candidateEdgeRows}`,
    `  Deleted rows: ${result.derivedMetadata.deletedRows}`,
    `  Deleted symbol nodes: ${result.derivedMetadata.deletedNodeRows}`,
    `  Deleted symbol edges: ${result.derivedMetadata.deletedEdgeRows}`,
    `  Protected snapshots: ${result.derivedMetadata.protectedSnapshots}`,
    `  Protected rows: ${result.derivedMetadata.protectedRows}`,
    `  Protected symbol nodes: ${result.derivedMetadata.protectedNodeRows}`,
    `  Protected symbol edges: ${result.derivedMetadata.protectedEdgeRows}`,
    `  Protected reasons: latest_snapshot=${derivedProtectedReasons.latest_repo_snapshot ?? 0}, referenced=${derivedProtectedReasons.referenced_by_context_artifact ?? 0}, edge_reference=${derivedProtectedReasons.incoming_symbol_edge_reference ?? 0}`,
    `  symbol_nodes: ${derivedRows.symbolNodes}`,
    `  symbol_edges: ${derivedRows.symbolEdges}`,
    "",
    "Repo snapshots:",
    `  Cutoff: ${result.snapshots.cutoff}`,
    `  Stored snapshots: ${result.snapshots.totalSnapshots}`,
    `  Matched snapshots: ${result.snapshots.retentionMatchedSnapshots}`,
    `  Eligible orphan snapshots: ${result.snapshots.candidateSnapshots}`,
    `  Deleted snapshots: ${result.snapshots.deletedSnapshots}`,
    `  Eligible worktree rows: ${result.snapshots.candidateWorktreeRows}`,
    `  Protected snapshots: ${result.snapshots.protectedSnapshots}`,
    `  Protected worktree rows: ${result.snapshots.protectedWorktreeRows}`,
    `  Protected reasons: latest_snapshot=${snapshotProtectedReasons.latest_repo_snapshot ?? 0}, session=${snapshotProtectedReasons.context_session ?? 0}, artifact=${snapshotProtectedReasons.context_artifact ?? 0}, compression=${snapshotProtectedReasons.compression_artifact ?? 0}, fts=${snapshotProtectedReasons.fts_entry ?? 0}, symbol_node=${snapshotProtectedReasons.symbol_node ?? 0}, symbol_edge=${snapshotProtectedReasons.symbol_edge ?? 0}, dependency=${snapshotProtectedReasons.context_dependency ?? 0}, source=${snapshotProtectedReasons.source ?? 0}`,
    `  repo_snapshots: ${snapshotRows.repoSnapshots}`,
    `  worktree_states: ${snapshotRows.worktreeStates}`,
    "",
    "Invalidated records:",
    `  Cutoff: ${result.invalidatedRecords.cutoff}`,
    `  Stored invalidations: ${result.invalidatedRecords.totalInvalidations}`,
    `  Matched invalidations: ${result.invalidatedRecords.retentionMatchedInvalidations}`,
    `  Eligible invalidations: ${result.invalidatedRecords.candidateInvalidations}`,
    `  Deleted invalidation pack rows: ${result.invalidatedRecords.deletedInvalidationPackItems}`,
    `  Deleted invalidated sent rows: ${result.invalidatedRecords.deletedInvalidatedSentItems}`,
    `  Deleted invalidated sent pack rows: ${result.invalidatedRecords.deletedInvalidatedSentPackItems}`,
    `  Protected invalidations: ${result.invalidatedRecords.protectedInvalidations}`,
    `  Protected reasons: locked=${invalidatedProtectedReasons.locked_session ?? 0}, sent_retained=${invalidatedProtectedReasons.sent_row_retained ?? 0}`,
    `  invalidation context_pack_items: ${invalidatedRows.invalidationPackItems}`,
    `  context_sent_items: ${invalidatedRows.invalidatedSentItems}`,
    `  sent context_pack_items: ${invalidatedRows.invalidatedSentPackItems}`,
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
