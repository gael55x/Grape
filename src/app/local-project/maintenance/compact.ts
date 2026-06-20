import { existsSync, lstatSync, rmSync } from "node:fs";
import path from "node:path";

import {
  createMaintenanceStorageRepositories,
  runStorageTransaction,
  type CompressionRetentionPlan,
  type ContextArtifactRetentionPlan
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
    readonly compressionInputs: {
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

      if (dryRun) {
        return {
          plan,
          compressionPlan,
          files: summarizeArtifactFiles(fileCandidates),
          deletedArtifacts: 0,
          deletedCompressionArtifacts: 0,
          deletedFiles: 0,
          deletedBytes: 0
        };
      }

      const deletion = runStorageTransaction(database, () => ({
        deletedArtifacts: maintenance.retention.deleteContextArtifacts(artifactIds),
        deletedCompressionArtifacts: maintenance.retention.deleteCompressionArtifacts(compressionIds)
      }));
      const fileDeletion = deletePlannedArtifactFiles(fileCandidates);
      return {
        plan,
        compressionPlan,
        files: summarizeArtifactFiles(fileCandidates),
        deletedArtifacts: deletion.deletedArtifacts,
        deletedCompressionArtifacts: deletion.deletedCompressionArtifacts,
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
      (value.plan.candidateArtifacts.length > 0 || value.compressionPlan.candidateArtifacts.length > 0),
    migrationsApplied: databaseResult.migrationResult.applied.map((migration) => migration.id),
    retention: {
      contextArtifacts: config.retention.contextArtifacts,
      compressionInputs: config.retention.compressionInputs
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
    notes: compactNotes({
      dryRun,
      candidateArtifacts: value.plan.candidateArtifacts.length,
      candidateCompressionArtifacts: value.compressionPlan.candidateArtifacts.length,
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

function compactNotes(input: {
  readonly dryRun: boolean;
  readonly candidateArtifacts: number;
  readonly candidateCompressionArtifacts: number;
  readonly skippedUnsafeFiles: number;
}): readonly string[] {
  const notes: string[] = [];
  if (input.dryRun) {
    notes.push("No data was deleted. Rerun with --confirm to apply this plan.");
  }
  if (input.candidateArtifacts === 0 && input.candidateCompressionArtifacts === 0) {
    notes.push("No context artifacts or compression cache rows are eligible for deletion.");
  }
  if (input.skippedUnsafeFiles > 0) {
    notes.push("Some artifact files were skipped because they were symlinks or not regular files.");
  }
  notes.push("This compact run applies context artifact and compression cache retention.");
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
