import {
  createMaintenanceStorageRepositories,
  runStorageTransaction,
  type CompressionRetentionPlan,
  type ContextArtifactRetentionPlan,
  type DerivedMetadataRetentionPlan,
  type FtsRetentionPlan,
  type InvalidatedRecordRetentionPlan,
  type SnapshotRetentionPlan
} from "../../../core/storage/index.js";
import { ensureConfiguredLocalProjectLayout } from "../setup/configured-layout.js";
import { withMigratedLocalDatabase } from "../setup/storage.js";
import {
  deletePlannedArtifactFiles,
  planArtifactFiles,
  summarizeArtifactFiles
} from "./artifact-file-retention.js";
import {
  compactNotes,
  countCompressionProtectedReasons,
  countDerivedMetadataProtectedReasons,
  countFtsProtectedReasons,
  countInvalidatedRecordProtectedReasons,
  countProtectedReasons,
  countSnapshotProtectedReasons,
  sumDerivedMetadataDeletionRows,
  sumDerivedMetadataEdgeRows,
  sumDerivedMetadataNodeRows,
  sumDerivedMetadataRows,
  sumSnapshotWorktreeRows
} from "./compact-result-summary.js";
import {
  measureStorageFootprint,
  storageFootprintReport,
  type StorageFootprintReport
} from "./storage-footprint.js";

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
    readonly invalidatedRecords: {
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
  readonly invalidatedRecords: {
    readonly cutoff: string;
    readonly totalInvalidations: number;
    readonly retentionMatchedInvalidations: number;
    readonly candidateInvalidations: number;
    readonly deletedInvalidationPackItems: number;
    readonly deletedInvalidatedSentItems: number;
    readonly deletedInvalidatedSentPackItems: number;
    readonly protectedInvalidations: number;
    readonly protectedByReason: Readonly<Record<string, number>>;
    readonly rowCounts: InvalidatedRecordRetentionPlan["rowCounts"];
  };
  readonly storageFootprint: StorageFootprintReport;
  readonly notes: readonly string[];
}

export function compactLocalProject(input: CompactLocalProjectInput): CompactLocalProjectResult {
  if (input.dryRun && input.confirm) {
    throw new Error("Choose either --dry-run or --confirm, not both.");
  }

  const now = input.now ?? new Date().toISOString();
  const { layout, config } = ensureConfiguredLocalProjectLayout(input.rootPath);
  const dryRun = !input.confirm;
  const footprintInput = {
    grapeDirPath: layout.grapeDirPath,
    databasePath: layout.databasePath,
    artifactDirPath: layout.artifactDirPath
  };

  const databaseResult = withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database) {
      const footprintBefore = measureStorageFootprint(footprintInput);
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
      const invalidatedRecordPlan = maintenance.retention.planInvalidatedRecordCompaction({
        now,
        limit: config.retention.invalidatedRecords
      });
      const invalidationPackItemIds = invalidatedRecordPlan.candidateInvalidations.map(
        (record) => record.invalidationPackItemId
      );

      if (dryRun) {
        return {
          plan,
          compressionPlan,
          ftsPlan,
          derivedMetadataPlan,
          snapshotPlan,
          invalidatedRecordPlan,
          files: summarizeArtifactFiles(fileCandidates),
          deletedArtifacts: 0,
          deletedCompressionArtifacts: 0,
          deletedFtsRows: 0,
          deletedDerivedMetadataRows: { symbolNodes: 0, symbolEdges: 0 },
          deletedSnapshots: 0,
          deletedInvalidatedRecords: {
            invalidationPackItems: 0,
            invalidatedSentItems: 0,
            invalidatedSentPackItems: 0
          },
          deletedFiles: 0,
          deletedBytes: 0,
          footprintBefore
        };
      }

      const deletion = runStorageTransaction(database, () => {
        const deletedInvalidatedRecords =
          maintenance.retention.deleteInvalidatedRecords(invalidationPackItemIds);
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
          deletedSnapshots,
          deletedInvalidatedRecords
        };
      });
      const fileDeletion = deletePlannedArtifactFiles(fileCandidates);
      return {
        plan,
        compressionPlan,
        ftsPlan,
        derivedMetadataPlan,
        snapshotPlan: deletion.snapshotPlan,
        invalidatedRecordPlan,
        files: summarizeArtifactFiles(fileCandidates),
        deletedArtifacts: deletion.deletedArtifacts,
        deletedCompressionArtifacts: deletion.deletedCompressionArtifacts,
        deletedFtsRows: deletion.deletedFtsRows,
        deletedDerivedMetadataRows: deletion.deletedDerivedMetadataRows,
        deletedSnapshots: deletion.deletedSnapshots,
        deletedInvalidatedRecords: deletion.deletedInvalidatedRecords,
        deletedFiles: fileDeletion.deletedFiles,
        deletedBytes: fileDeletion.deletedBytes,
        footprintBefore
      };
    }
  });

  const value = databaseResult.value;
  const fileSummary = value.files;
  const storageFootprint = dryRun
    ? storageFootprintReport({
        before: value.footprintBefore,
        after: value.footprintBefore,
        afterMeasuredPostApply: false
      })
    : storageFootprintReport({
        before: value.footprintBefore,
        after: measureStorageFootprint(footprintInput),
        afterMeasuredPostApply: true
      });
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
        value.snapshotPlan.candidateSnapshots.length > 0 ||
        value.invalidatedRecordPlan.candidateInvalidations.length > 0),
    migrationsApplied: databaseResult.migrationResult.applied.map((migration) => migration.id),
    retention: {
      contextArtifacts: config.retention.contextArtifacts,
      snapshots: config.retention.snapshots,
      compressionInputs: config.retention.compressionInputs,
      ftsRows: config.retention.ftsRows,
      derivedMetadata: config.retention.derivedMetadata,
      invalidatedRecords: config.retention.invalidatedRecords
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
    invalidatedRecords: {
      cutoff: value.invalidatedRecordPlan.cutoff,
      totalInvalidations: value.invalidatedRecordPlan.totalInvalidations,
      retentionMatchedInvalidations: value.invalidatedRecordPlan.retentionMatchedInvalidations,
      candidateInvalidations: value.invalidatedRecordPlan.candidateInvalidations.length,
      deletedInvalidationPackItems: value.deletedInvalidatedRecords.invalidationPackItems,
      deletedInvalidatedSentItems: value.deletedInvalidatedRecords.invalidatedSentItems,
      deletedInvalidatedSentPackItems: value.deletedInvalidatedRecords.invalidatedSentPackItems,
      protectedInvalidations: value.invalidatedRecordPlan.protectedInvalidations.length,
      protectedByReason: countInvalidatedRecordProtectedReasons(value.invalidatedRecordPlan),
      rowCounts: value.invalidatedRecordPlan.rowCounts
    },
    storageFootprint,
    notes: compactNotes({
      dryRun,
      candidateArtifacts: value.plan.candidateArtifacts.length,
      candidateCompressionArtifacts: value.compressionPlan.candidateArtifacts.length,
      candidateFtsSnapshots: value.ftsPlan.candidateSnapshots.length,
      candidateDerivedMetadataSnapshots: value.derivedMetadataPlan.candidateSnapshots.length,
      candidateSnapshots: value.snapshotPlan.candidateSnapshots.length,
      candidateInvalidatedRecords: value.invalidatedRecordPlan.candidateInvalidations.length,
      skippedUnsafeFiles: fileSummary.skippedUnsafeFiles
    })
  };
}
