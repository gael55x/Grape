import { initializeLocalProject } from "./initialize.js";
import type { LocalProjectConfigWriteStatus } from "./config.js";
import type { LocalScanDiagnostics } from "./scan-diagnostics.js";

export interface SyncLocalProjectInput {
  readonly rootPath: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface SyncLocalProjectResult {
  readonly rootPath: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly branch: string;
  readonly headCommit: string;
  readonly dirtyWorktree: boolean;
  readonly configStatus: LocalProjectConfigWriteStatus;
  readonly configBackupPath?: string;
  readonly databaseBackupPath?: string;
  readonly databasePath: string;
  readonly migrationsApplied: readonly string[];
  readonly scan: LocalScanDiagnostics;
  readonly recoveryGuidance: readonly string[];
}

export function syncLocalProject(input: SyncLocalProjectInput): SyncLocalProjectResult {
  const result = initializeLocalProject({
    rootPath: input.rootPath,
    now: input.now,
    gitBinary: input.gitBinary,
    migrationsDir: input.migrationsDir
  });

  return {
    rootPath: result.rootPath,
    projectId: result.projectId,
    repoId: result.repoId,
    snapshotId: result.snapshotId,
    worktreeStateId: result.worktreeStateId,
    branch: result.branch,
    headCommit: result.headCommit,
    dirtyWorktree: result.dirtyWorktree,
    configStatus: result.configStatus,
    configBackupPath: result.configBackupPath,
    databaseBackupPath: result.databaseBackupPath,
    databasePath: result.databasePath,
    migrationsApplied: result.migrationsApplied,
    scan: result.scan,
    recoveryGuidance: syncRecoveryGuidance(result.dirtyWorktree)
  };
}

function syncRecoveryGuidance(dirtyWorktree: boolean): readonly string[] {
  if (!dirtyWorktree) return [];
  return [
    "Dirty files are indexed as worktree-scoped context only. Commit, stage, or discard changes when you need branch-global context."
  ];
}
