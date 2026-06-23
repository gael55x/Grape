import {
  type CompressionRetentionPlan,
  type ContextArtifactRetentionPlan,
  type DerivedMetadataDeletionResult,
  type DerivedMetadataRetentionPlan,
  type FtsRetentionPlan,
  type InvalidatedRecordRetentionPlan,
  type SnapshotRetentionPlan
} from "../../../core/storage/index.js";

export function countProtectedReasons(
  plan: ContextArtifactRetentionPlan
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {
    latest_per_session: 0,
    active_sent_context: 0,
    restorable_omitted_context: 0,
    locked_session: 0,
    invalidation_marker: 0
  };
  for (const artifact of plan.protectedArtifacts) {
    counts[artifact.protection] = (counts[artifact.protection] ?? 0) + 1;
  }
  return counts;
}

export function countCompressionProtectedReasons(
  plan: CompressionRetentionPlan
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {
    referenced_by_context_artifact: 0
  };
  for (const artifact of plan.protectedArtifacts) {
    counts[artifact.protection] = (counts[artifact.protection] ?? 0) + 1;
  }
  return counts;
}

export function countFtsProtectedReasons(plan: FtsRetentionPlan): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {
    latest_repo_snapshot: 0
  };
  for (const snapshot of plan.protectedSnapshots) {
    counts[snapshot.protection] = (counts[snapshot.protection] ?? 0) + 1;
  }
  return counts;
}

export function countDerivedMetadataProtectedReasons(
  plan: DerivedMetadataRetentionPlan
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {
    latest_repo_snapshot: 0,
    referenced_by_context_artifact: 0,
    incoming_symbol_edge_reference: 0
  };
  for (const snapshot of plan.protectedSnapshots) {
    counts[snapshot.protection] = (counts[snapshot.protection] ?? 0) + 1;
  }
  return counts;
}

export function countSnapshotProtectedReasons(plan: SnapshotRetentionPlan): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {
    latest_repo_snapshot: 0,
    context_session: 0,
    context_artifact: 0,
    compression_artifact: 0,
    fts_entry: 0,
    symbol_node: 0,
    symbol_edge: 0,
    context_dependency: 0,
    source: 0
  };
  for (const snapshot of plan.protectedSnapshots) {
    counts[snapshot.protection] = (counts[snapshot.protection] ?? 0) + 1;
  }
  return counts;
}

export function countInvalidatedRecordProtectedReasons(
  plan: InvalidatedRecordRetentionPlan
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {
    locked_session: 0,
    sent_row_retained: 0
  };
  for (const record of plan.protectedInvalidations) {
    counts[record.protection] = (counts[record.protection] ?? 0) + 1;
  }
  return counts;
}

export function sumDerivedMetadataRows(
  snapshots: readonly { readonly totalRows: number }[]
): number {
  return snapshots.reduce((total, snapshot) => total + snapshot.totalRows, 0);
}

export function sumDerivedMetadataNodeRows(
  snapshots: readonly { readonly nodeRows: number }[]
): number {
  return snapshots.reduce((total, snapshot) => total + snapshot.nodeRows, 0);
}

export function sumDerivedMetadataEdgeRows(
  snapshots: readonly { readonly edgeRows: number }[]
): number {
  return snapshots.reduce((total, snapshot) => total + snapshot.edgeRows, 0);
}

export function sumDerivedMetadataDeletionRows(deletion: DerivedMetadataDeletionResult): number {
  return deletion.symbolNodes + deletion.symbolEdges;
}

export function sumSnapshotWorktreeRows(
  snapshots: readonly { readonly worktreeRows: number }[]
): number {
  return snapshots.reduce((total, snapshot) => total + snapshot.worktreeRows, 0);
}

export function compactNotes(input: {
  readonly dryRun: boolean;
  readonly candidateArtifacts: number;
  readonly candidateCompressionArtifacts: number;
  readonly candidateFtsSnapshots: number;
  readonly candidateDerivedMetadataSnapshots: number;
  readonly candidateSnapshots: number;
  readonly candidateInvalidatedRecords: number;
  readonly skippedUnsafeFiles: number;
}): readonly string[] {
  const notes: string[] = [];
  if (input.dryRun) {
    notes.push("No data was deleted. Rerun with --confirm to apply this plan.");
  }
  if (
    input.candidateArtifacts === 0 &&
    input.candidateCompressionArtifacts === 0 &&
    input.candidateFtsSnapshots === 0 &&
    input.candidateDerivedMetadataSnapshots === 0 &&
    input.candidateSnapshots === 0 &&
    input.candidateInvalidatedRecords === 0
  ) {
    notes.push("No context artifacts, compression cache rows, FTS rows, derived metadata rows, orphan snapshots, or invalidated ledger rows are eligible for deletion.");
  }
  if (input.skippedUnsafeFiles > 0) {
    notes.push("Some artifact files were skipped because they were symlinks or not regular files.");
  }
  notes.push("This compact run applies context artifact, compression cache, FTS, derived metadata, orphan snapshot, and invalidated-record retention.");
  return notes;
}
