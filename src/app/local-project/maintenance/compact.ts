import { existsSync, lstatSync, rmSync } from "node:fs";
import path from "node:path";

import {
  createMaintenanceStorageRepositories,
  runStorageTransaction,
  type CompressionRetentionPlan,
  type ContextArtifactRetentionPlan,
  type DerivedMetadataDeletionResult,
  type DerivedMetadataRetentionPlan,
  type FtsRetentionPlan,
  type SnapshotRetentionPlan
} from "../../../core/storage/index.js";
import { artifactFileBaseName } from "../context/artifact-files.js";
import { ensureConfiguredLocalProjectLayout } from "../setup/configured-layout.js";
import { withMigratedLocalDatabase } from "../setup/storage.js";

export interface CompactLocalProjectInput {
  readonly rootPath: string;
  readonly dryRun?: boolean;
  readonly confirm?: boolean;
  readonly now?: string;
  readonly migrationsDir?: string;
}

export interface CompactLocalProjectResult {
  readonly rootPath: string;
  readonly databasePath: string;
  readonly dryRun: boolean;
  readonly applied: boolean;
  readonly confirmationRequired: boolean;
  readonly migrationsApplied: readonly string[];
  readonly retention: {
    readonly contextArtifacts: {
      readonly maxAgeDays: number;
      readonly maxRows: number;
    };
    readonly snapshots: {
      readonly maxAgeDays: number;
      readonly maxRows: number;
    };
    readonly compressionInputs: {
      readonly maxAgeDays: number;
      readonly maxRows: number;
    };
    readonly ftsRows: {
      readonly maxAgeDays: number;
      readonly maxRows: number;
    };
    readonly derivedMetadata: {
      readonly maxAgeDays: number;
      readonly maxRows: number;
    };
  };
  readonly contextArtifacts: {
    readonly cutoff: string;
    readonly totalArtifacts: number;
    readonly retentionMatchedArtifacts: number;
    readonly candidateArtifacts: number;
    readonly deletedArtifacts: number;
    readonly protectedArtifacts: number;
    readonly protectedByReason: Readonly<Record<string, number>>;
    readonly rowCounts: ContextArtifactRetentionPlan["rowCounts"];
    readonly artifactFiles: {
      readonly plannedFiles: number;
      readonly plannedBytes: number;
      readonly deletedFiles: number;
      readonly deletedBytes: number;
      readonly skippedUnsafeFiles: number;
      readonly skippedMissingFiles: number;
    };
  };
  readonly compressionCache: {
    readonly cutoff: string;
    readonly totalArtifacts: number;
    readonly totalInputRows: number;
    readonly retentionMatchedArtifacts: number;
    readonly candidateArtifacts: number;
    readonly deletedArtifacts: number;
    readonly protectedArtifacts: number;
    readonly protectedByReason: Readonly<Record<string, number>>;
    readonly rowCounts: CompressionRetentionPlan["rowCounts"];
  };
  readonly ftsIndex: {
    readonly cutoff: string;
    readonly totalSnapshots: number;
    readonly totalRows: number;
    readonly retentionMatchedSnapshots: number;
    readonly retentionMatchedRows: number;
    readonly candidateSnapshots: number;
    readonly candidateRows: number;
    readonly deletedRows: number;
    readonly protectedSnapshots: number;
    readonly protectedRows: number;
    readonly protectedByReason: Readonly<Record<string, number>>;
    readonly rowCounts: FtsRetentionPlan["rowCounts"];
  };
  readonly derivedMetadata: {
    readonly cutoff: string;
    readonly totalSnapshots: number;
    readonly totalRows: number;
    readonly totalNodeRows: number;
    readonly totalEdgeRows: number;
    readonly retentionMatchedSnapshots: number;
    readonly retentionMatchedRows: number;
    readonly candidateSnapshots: number;
    readonly candidateRows: number;
    readonly candidateNodeRows: number;
    readonly candidateEdgeRows: number;
    readonly deletedRows: number;
    readonly deletedNodeRows: number;
    readonly deletedEdgeRows: number;
    readonly protectedSnapshots: number;
    readonly protectedRows: number;
    readonly protectedNodeRows: number;
    readonly protectedEdgeRows: number;
    readonly protectedByReason: Readonly<Record<string, number>>;
    readonly rowCounts: DerivedMetadataRetentionPlan["rowCounts"];
  };
  readonly snapshots: {
    readonly cutoff: string;
    readonly totalSnapshots: number;
    readonly retentionMatchedSnapshots: number;
    readonly candidateSnapshots: number;
    readonly deletedSnapshots: number;
    readonly candidateWorktreeRows: number;
    readonly protectedSnapshots: number;
    readonly protectedWorktreeRows: number;
    readonly protectedByReason: Readonly<Record<string, number>>;
    readonly rowCounts: SnapshotRetentionPlan["rowCounts"];
  };
  readonly notes: readonly string[];
}

interface ArtifactFileCandidate {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly bytes: number;
  readonly status: "delete" | "missing" | "unsafe";
  readonly unsafeReason?: string;
}

export function compactLocalProject(input: CompactLocalProjectInput): CompactLocalProjectResult {
  if (input.dryRun && input.confirm) {
    throw new Error("Choose either --dry-run or --confirm, not both.");
  }

  const now = input.now ?? new Date().toISOString();
  const { layout, config } = ensureConfiguredLocalProjectLayout(input.rootPath);
  const dryRun = !input.confirm;

  const databaseResult = withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database) {
      const maintenance = createMaintenanceStorageRepositories(database);
      const plan = maintenance.retention.planContextArtifactCompaction({
        now,
        limit: config.retention.contextArtifacts
      });
      const artifactIds = plan.candidateArtifacts.map((artifact) => artifact.artifactId);
      const fileCandidates = planArtifactFiles({
        rootPath: layout.rootPath,
        artifactDirPath: layout.artifactDirPath,
        artifactIds
      });
      const compressionPlan = maintenance.retention.planCompressionCompaction({
        now,
        limit: config.retention.compressionInputs,
        ignoredContextArtifactIds: artifactIds
      });
      const compressionIds = compressionPlan.candidateArtifacts.map((artifact) => artifact.compressionId);
      const ftsPlan = maintenance.retention.planFtsCompaction({
        now,
        limit: config.retention.ftsRows
      });
      const ftsSnapshotIds = ftsPlan.candidateSnapshots.map((snapshot) => snapshot.snapshotId);
      const derivedMetadataPlan = maintenance.retention.planDerivedMetadataCompaction({
        now,
        limit: config.retention.derivedMetadata,
        ignoredContextArtifactIds: artifactIds
      });
      const derivedMetadataSnapshotIds = derivedMetadataPlan.candidateSnapshots.map(
        (snapshot) => snapshot.snapshotId
      );
      const snapshotPlan = maintenance.retention.planSnapshotCompaction({
        now,
        limit: config.retention.snapshots,
        ignoredContextArtifactIds: artifactIds,
        ignoredCompressionIds: compressionIds,
        ignoredFtsSnapshotIds: ftsSnapshotIds,
        ignoredDerivedMetadataSnapshotIds: derivedMetadataSnapshotIds
      });

      if (dryRun) {
        return {
          plan,
          compressionPlan,
          ftsPlan,
          derivedMetadataPlan,
          snapshotPlan,
          files: summarizeArtifactFiles(fileCandidates),
          deletedArtifacts: 0,
          deletedCompressionArtifacts: 0,
          deletedFtsRows: 0,
          deletedDerivedMetadataRows: { symbolNodes: 0, symbolEdges: 0 },
          deletedSnapshots: 0,
          deletedFiles: 0,
          deletedBytes: 0
        };
      }

      const deletion = runStorageTransaction(database, () => {
        const deletedArtifacts = maintenance.retention.deleteContextArtifacts(artifactIds);
        const deletedCompressionArtifacts = maintenance.retention.deleteCompressionArtifacts(compressionIds);
        const deletedFtsRows = maintenance.retention.deleteFtsSnapshots(ftsSnapshotIds);
        const deletedDerivedMetadataRows =
          maintenance.retention.deleteDerivedMetadataSnapshots(derivedMetadataSnapshotIds);
        const refreshedSnapshotPlan = maintenance.retention.planSnapshotCompaction({
          now,
          limit: config.retention.snapshots
        });
        const refreshedSnapshotIds = refreshedSnapshotPlan.candidateSnapshots.map(
          (snapshot) => snapshot.snapshotId
        );
        const deletedSnapshots = maintenance.retention.deleteRepoSnapshots(refreshedSnapshotIds);
        return {
          snapshotPlan: refreshedSnapshotPlan,
          deletedArtifacts,
          deletedCompressionArtifacts,
          deletedFtsRows,
          deletedDerivedMetadataRows,
          deletedSnapshots
        };
      });
      const fileDeletion = deletePlannedArtifactFiles(fileCandidates);
      return {
        plan,
        compressionPlan,
        ftsPlan,
        derivedMetadataPlan,
        snapshotPlan: deletion.snapshotPlan,
        files: summarizeArtifactFiles(fileCandidates),
        deletedArtifacts: deletion.deletedArtifacts,
        deletedCompressionArtifacts: deletion.deletedCompressionArtifacts,
        deletedFtsRows: deletion.deletedFtsRows,
        deletedDerivedMetadataRows: deletion.deletedDerivedMetadataRows,
        deletedSnapshots: deletion.deletedSnapshots,
        deletedFiles: fileDeletion.deletedFiles,
        deletedBytes: fileDeletion.deletedBytes
      };
    }
  });

  const value = databaseResult.value;
  const fileSummary = value.files;
  return {
    rootPath: layout.rootPath,
    databasePath: layout.databasePath,
    dryRun,
    applied: !dryRun,
    confirmationRequired:
      dryRun &&
      (value.plan.candidateArtifacts.length > 0 ||
        value.compressionPlan.candidateArtifacts.length > 0 ||
        value.ftsPlan.candidateSnapshots.length > 0 ||
        value.derivedMetadataPlan.candidateSnapshots.length > 0 ||
        value.snapshotPlan.candidateSnapshots.length > 0),
    migrationsApplied: databaseResult.migrationResult.applied.map((migration) => migration.id),
    retention: {
      contextArtifacts: config.retention.contextArtifacts,
      snapshots: config.retention.snapshots,
      compressionInputs: config.retention.compressionInputs,
      ftsRows: config.retention.ftsRows,
      derivedMetadata: config.retention.derivedMetadata
    },
    contextArtifacts: {
      cutoff: value.plan.cutoff,
      totalArtifacts: value.plan.totalArtifacts,
      retentionMatchedArtifacts: value.plan.retentionMatchedArtifacts,
      candidateArtifacts: value.plan.candidateArtifacts.length,
      deletedArtifacts: value.deletedArtifacts,
      protectedArtifacts: value.plan.protectedArtifacts.length,
      protectedByReason: countProtectedReasons(value.plan),
      rowCounts: value.plan.rowCounts,
      artifactFiles: {
        plannedFiles: fileSummary.plannedFiles,
        plannedBytes: fileSummary.plannedBytes,
        deletedFiles: value.deletedFiles,
        deletedBytes: value.deletedBytes,
        skippedUnsafeFiles: fileSummary.skippedUnsafeFiles,
        skippedMissingFiles: fileSummary.skippedMissingFiles
      }
    },
    compressionCache: {
      cutoff: value.compressionPlan.cutoff,
      totalArtifacts: value.compressionPlan.totalArtifacts,
      totalInputRows: value.compressionPlan.totalInputRows,
      retentionMatchedArtifacts: value.compressionPlan.retentionMatchedArtifacts,
      candidateArtifacts: value.compressionPlan.candidateArtifacts.length,
      deletedArtifacts: value.deletedCompressionArtifacts,
      protectedArtifacts: value.compressionPlan.protectedArtifacts.length,
      protectedByReason: countCompressionProtectedReasons(value.compressionPlan),
      rowCounts: value.compressionPlan.rowCounts
    },
    ftsIndex: {
      cutoff: value.ftsPlan.cutoff,
      totalSnapshots: value.ftsPlan.totalSnapshots,
      totalRows: value.ftsPlan.totalRows,
      retentionMatchedSnapshots: value.ftsPlan.retentionMatchedSnapshots,
      retentionMatchedRows: value.ftsPlan.retentionMatchedRows,
      candidateSnapshots: value.ftsPlan.candidateSnapshots.length,
      candidateRows: value.ftsPlan.candidateSnapshots.reduce((total, snapshot) => total + snapshot.ftsRows, 0),
      deletedRows: value.deletedFtsRows,
      protectedSnapshots: value.ftsPlan.protectedSnapshots.length,
      protectedRows: value.ftsPlan.protectedSnapshots.reduce((total, snapshot) => total + snapshot.ftsRows, 0),
      protectedByReason: countFtsProtectedReasons(value.ftsPlan),
      rowCounts: value.ftsPlan.rowCounts
    },
    derivedMetadata: {
      cutoff: value.derivedMetadataPlan.cutoff,
      totalSnapshots: value.derivedMetadataPlan.totalSnapshots,
      totalRows: value.derivedMetadataPlan.totalRows,
      totalNodeRows: value.derivedMetadataPlan.totalNodeRows,
      totalEdgeRows: value.derivedMetadataPlan.totalEdgeRows,
      retentionMatchedSnapshots: value.derivedMetadataPlan.retentionMatchedSnapshots,
      retentionMatchedRows: value.derivedMetadataPlan.retentionMatchedRows,
      candidateSnapshots: value.derivedMetadataPlan.candidateSnapshots.length,
      candidateRows: sumDerivedMetadataRows(value.derivedMetadataPlan.candidateSnapshots),
      candidateNodeRows: sumDerivedMetadataNodeRows(value.derivedMetadataPlan.candidateSnapshots),
      candidateEdgeRows: sumDerivedMetadataEdgeRows(value.derivedMetadataPlan.candidateSnapshots),
      deletedRows: sumDerivedMetadataDeletionRows(value.deletedDerivedMetadataRows),
      deletedNodeRows: value.deletedDerivedMetadataRows.symbolNodes,
      deletedEdgeRows: value.deletedDerivedMetadataRows.symbolEdges,
      protectedSnapshots: value.derivedMetadataPlan.protectedSnapshots.length,
      protectedRows: sumDerivedMetadataRows(value.derivedMetadataPlan.protectedSnapshots),
      protectedNodeRows: sumDerivedMetadataNodeRows(value.derivedMetadataPlan.protectedSnapshots),
      protectedEdgeRows: sumDerivedMetadataEdgeRows(value.derivedMetadataPlan.protectedSnapshots),
      protectedByReason: countDerivedMetadataProtectedReasons(value.derivedMetadataPlan),
      rowCounts: value.derivedMetadataPlan.rowCounts
    },
    snapshots: {
      cutoff: value.snapshotPlan.cutoff,
      totalSnapshots: value.snapshotPlan.totalSnapshots,
      retentionMatchedSnapshots: value.snapshotPlan.retentionMatchedSnapshots,
      candidateSnapshots: value.snapshotPlan.candidateSnapshots.length,
      deletedSnapshots: value.deletedSnapshots,
      candidateWorktreeRows: sumSnapshotWorktreeRows(value.snapshotPlan.candidateSnapshots),
      protectedSnapshots: value.snapshotPlan.protectedSnapshots.length,
      protectedWorktreeRows: sumSnapshotWorktreeRows(value.snapshotPlan.protectedSnapshots),
      protectedByReason: countSnapshotProtectedReasons(value.snapshotPlan),
      rowCounts: value.snapshotPlan.rowCounts
    },
    notes: compactNotes({
      dryRun,
      candidateArtifacts: value.plan.candidateArtifacts.length,
      candidateCompressionArtifacts: value.compressionPlan.candidateArtifacts.length,
      candidateFtsSnapshots: value.ftsPlan.candidateSnapshots.length,
      candidateDerivedMetadataSnapshots: value.derivedMetadataPlan.candidateSnapshots.length,
      candidateSnapshots: value.snapshotPlan.candidateSnapshots.length,
      skippedUnsafeFiles: fileSummary.skippedUnsafeFiles
    })
  };
}

function planArtifactFiles(input: {
  readonly rootPath: string;
  readonly artifactDirPath: string;
  readonly artifactIds: readonly string[];
}): ArtifactFileCandidate[] {
  const files: ArtifactFileCandidate[] = [];
  for (const artifactId of input.artifactIds) {
    const baseName = artifactFileBaseName(artifactId);
    for (const suffix of [".json", ".md", ".repository.json"]) {
      const absolutePath = path.join(input.artifactDirPath, `${baseName}${suffix}`);
      const relativePath = repoRelativePath(input.rootPath, absolutePath);
      assertInsideDirectory(input.artifactDirPath, absolutePath);

      if (!existsSync(absolutePath)) {
        files.push({ absolutePath, relativePath, bytes: 0, status: "missing" });
        continue;
      }

      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        files.push({
          absolutePath,
          relativePath,
          bytes: 0,
          status: "unsafe",
          unsafeReason: "symlink"
        });
        continue;
      }
      if (!stat.isFile()) {
        files.push({
          absolutePath,
          relativePath,
          bytes: 0,
          status: "unsafe",
          unsafeReason: "not_regular_file"
        });
        continue;
      }

      files.push({
        absolutePath,
        relativePath,
        bytes: stat.size,
        status: "delete"
      });
    }
  }
  return files;
}

function summarizeArtifactFiles(files: readonly ArtifactFileCandidate[]): {
  readonly plannedFiles: number;
  readonly plannedBytes: number;
  readonly skippedUnsafeFiles: number;
  readonly skippedMissingFiles: number;
} {
  return {
    plannedFiles: files.filter((file) => file.status === "delete").length,
    plannedBytes: files.reduce((total, file) => (file.status === "delete" ? total + file.bytes : total), 0),
    skippedUnsafeFiles: files.filter((file) => file.status === "unsafe").length,
    skippedMissingFiles: files.filter((file) => file.status === "missing").length
  };
}

function deletePlannedArtifactFiles(files: readonly ArtifactFileCandidate[]): {
  readonly deletedFiles: number;
  readonly deletedBytes: number;
} {
  let deletedFiles = 0;
  let deletedBytes = 0;
  for (const file of files) {
    if (file.status !== "delete") continue;
    rmSync(file.absolutePath, { force: true });
    deletedFiles += 1;
    deletedBytes += file.bytes;
  }
  return { deletedFiles, deletedBytes };
}

function countProtectedReasons(
  plan: ContextArtifactRetentionPlan
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {
    latest_per_session: 0,
    active_sent_context: 0,
    restorable_omitted_context: 0,
    locked_session: 0
  };
  for (const artifact of plan.protectedArtifacts) {
    counts[artifact.protection] = (counts[artifact.protection] ?? 0) + 1;
  }
  return counts;
}

function countCompressionProtectedReasons(
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

function countFtsProtectedReasons(plan: FtsRetentionPlan): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {
    latest_repo_snapshot: 0
  };
  for (const snapshot of plan.protectedSnapshots) {
    counts[snapshot.protection] = (counts[snapshot.protection] ?? 0) + 1;
  }
  return counts;
}

function countDerivedMetadataProtectedReasons(
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

function countSnapshotProtectedReasons(plan: SnapshotRetentionPlan): Readonly<Record<string, number>> {
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

function sumDerivedMetadataRows(
  snapshots: readonly { readonly totalRows: number }[]
): number {
  return snapshots.reduce((total, snapshot) => total + snapshot.totalRows, 0);
}

function sumDerivedMetadataNodeRows(
  snapshots: readonly { readonly nodeRows: number }[]
): number {
  return snapshots.reduce((total, snapshot) => total + snapshot.nodeRows, 0);
}

function sumDerivedMetadataEdgeRows(
  snapshots: readonly { readonly edgeRows: number }[]
): number {
  return snapshots.reduce((total, snapshot) => total + snapshot.edgeRows, 0);
}

function sumDerivedMetadataDeletionRows(deletion: DerivedMetadataDeletionResult): number {
  return deletion.symbolNodes + deletion.symbolEdges;
}

function sumSnapshotWorktreeRows(
  snapshots: readonly { readonly worktreeRows: number }[]
): number {
  return snapshots.reduce((total, snapshot) => total + snapshot.worktreeRows, 0);
}

function compactNotes(input: {
  readonly dryRun: boolean;
  readonly candidateArtifacts: number;
  readonly candidateCompressionArtifacts: number;
  readonly candidateFtsSnapshots: number;
  readonly candidateDerivedMetadataSnapshots: number;
  readonly candidateSnapshots: number;
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
    input.candidateSnapshots === 0
  ) {
    notes.push("No context artifacts, compression cache rows, FTS rows, derived metadata rows, or orphan snapshots are eligible for deletion.");
  }
  if (input.skippedUnsafeFiles > 0) {
    notes.push("Some artifact files were skipped because they were symlinks or not regular files.");
  }
  notes.push("This compact run applies context artifact, compression cache, FTS, derived metadata, and orphan snapshot retention.");
  return notes;
}

function assertInsideDirectory(directoryPath: string, filePath: string): void {
  const relative = path.relative(directoryPath, filePath);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("refusing to touch an artifact file outside .grape/artifacts.");
  }
}

function repoRelativePath(rootPath: string, filePath: string): string {
  return path.relative(rootPath, filePath).split(path.sep).join("/");
}
