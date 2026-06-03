import path from "node:path";

import { createGitRepoSnapshot } from "../../../core/git/index.js";
import {
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createStorageRepositories
} from "../../../core/storage/index.js";
import { persistGitRepoSnapshot } from "../../persist-repo-snapshot.js";
import { detectLocalBootstrap } from "./bootstrap-detection.js";
import {
  defaultLocalProjectConfig,
  ensureLocalProjectLayout,
  writeLocalProjectConfig
} from "./config.js";
import { ensureGrapeExcludedFromGit } from "./git-exclude.js";
import { mcpConnectionGuide } from "./mcp-guide.js";
import { defaultProjectId } from "./project-id.js";
import { scanDiagnosticsForSnapshot } from "./scan-diagnostics.js";
import { withRepairableMigratedLocalDatabase } from "./storage.js";
import type { InitializeLocalProjectInput, InitializeLocalProjectResult } from "./setup-types.js";

export function initializeLocalProject(
  input: InitializeLocalProjectInput
): InitializeLocalProjectResult {
  const now = input.now ?? new Date().toISOString();
  const rootPath = path.resolve(input.rootPath);
  const snapshot = createGitRepoSnapshot({
    rootPath,
    createdAt: now,
    gitBinary: input.gitBinary
  });
  const projectId = defaultProjectId(snapshot.repoId);
  const layout = ensureLocalProjectLayout(snapshot.rootPath);
  const bootstrap = detectLocalBootstrap(snapshot.rootPath);
  const excludeStatus = ensureGrapeExcludedFromGit(snapshot.rootPath, input.gitBinary);
  const config = defaultLocalProjectConfig({
    projectId,
    repoId: snapshot.repoId,
    rootPath: snapshot.rootPath,
    initializedAt: now
  });
  const configWrite = writeLocalProjectConfig(layout.configPath, config, { now });

  const databaseResult = withRepairableMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database) {
      const repositories = createStorageRepositories(database);
      const evidenceRepositories = createEvidenceStorageRepositories(database);
      const indexingRepositories = createIndexingStorageRepositories(database);
      return persistGitRepoSnapshot({
        database,
        repositories,
        evidenceRepositories,
        indexingRepositories,
        rootPath: snapshot.rootPath,
        snapshot,
        projectId,
        repoId: snapshot.repoId,
        gitBinary: input.gitBinary,
        now
      });
    }
  });

  return {
    rootPath: snapshot.rootPath,
    grapeDirPath: layout.grapeDirPath,
    configPath: layout.configPath,
    databasePath: layout.databasePath,
    configStatus: configWrite.status,
    configBackupPath: configWrite.backupPath,
    databaseBackupPath: databaseResult.databaseBackupPath,
    excludeStatus,
    createdDirs: layout.createdDirs,
    projectId,
    repoId: snapshot.repoId,
    snapshotId: databaseResult.value.snapshotId,
    worktreeStateId: databaseResult.value.worktreeStateId,
    branch: snapshot.branch,
    headCommit: snapshot.commit,
    dirtyWorktree: snapshot.worktreeStatus !== "clean",
    migrationsApplied: databaseResult.migrationResult.applied.map((migration) => migration.id),
    bootstrap,
    scan: scanDiagnosticsForSnapshot(snapshot),
    mcp: mcpConnectionGuide(snapshot.rootPath)
  };
}
