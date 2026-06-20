import { existsSync, lstatSync, rmSync } from "node:fs";
import path from "node:path";

import {
  createMaintenanceStorageRepositories,
  runStorageTransaction,
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

      if (dryRun) {
        return {
          plan,
          files: summarizeArtifactFiles(fileCandidates),
          deletedArtifacts: 0,
          deletedFiles: 0,
          deletedBytes: 0
        };
      }

      const deletedArtifacts = runStorageTransaction(database, () =>
        maintenance.retention.deleteContextArtifacts(artifactIds)
      );
      const fileDeletion = deletePlannedArtifactFiles(fileCandidates);
      return {
        plan,
        files: summarizeArtifactFiles(fileCandidates),
        deletedArtifacts,
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
    confirmationRequired: dryRun && value.plan.candidateArtifacts.length > 0,
    migrationsApplied: databaseResult.migrationResult.applied.map((migration) => migration.id),
    retention: {
      contextArtifacts: config.retention.contextArtifacts
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
    notes: compactNotes({
      dryRun,
      candidateArtifacts: value.plan.candidateArtifacts.length,
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

function compactNotes(input: {
  readonly dryRun: boolean;
  readonly candidateArtifacts: number;
  readonly skippedUnsafeFiles: number;
}): readonly string[] {
  const notes: string[] = [];
  if (input.dryRun) {
    notes.push("No data was deleted. Rerun with --confirm to apply this plan.");
  }
  if (input.candidateArtifacts === 0) {
    notes.push("No context artifacts are eligible for deletion.");
  }
  if (input.skippedUnsafeFiles > 0) {
    notes.push("Some artifact files were skipped because they were symlinks or not regular files.");
  }
  notes.push("This compact slice only applies context artifact retention.");
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
