import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { createGitRepoSnapshot, type RepoSnapshot } from "../../../core/git/index.js";
import {
  planPendingStorageMigrations,
  readAppliedStorageMigrations,
  storageMigrationReferences
} from "../../../core/storage/index.js";
import {
  isRepairableLocalProjectConfigError,
  readLocalProjectConfig,
  type LocalProjectConfig,
  type LocalProjectLayout
} from "./config.js";
import { recoveryGuidanceForStatus } from "./recovery.js";
import { scanDiagnosticsForSnapshot } from "./scan-diagnostics.js";
import { readStorageMigrationSources } from "./storage.js";
import type { LocalProjectStatus } from "./setup-types.js";

export function readLocalProjectStatus(rootPathInput: string): LocalProjectStatus {
  const warnings: string[] = [];
  const errors: string[] = [];
  let config: LocalProjectConfig | undefined;
  let snapshot: RepoSnapshot | undefined;
  let rootPath = path.resolve(rootPathInput);
  let appliedMigrations: string[] = [];
  let pendingMigrations: string[] = storageMigrationReferences.map((migration) => migration.id);

  try {
    snapshot = createGitRepoSnapshot({ rootPath, createdAt: new Date().toISOString() });
    rootPath = snapshot.rootPath;
  } catch (error) {
    errors.push(`git snapshot failed: ${errorMessage(error)}`);
  }

  const layout = layoutForStatus(rootPath);

  try {
    config = readLocalProjectConfig(layout.configPath);
  } catch (error) {
    const detail = errorMessage(error);
    errors.push(
      isRepairableLocalProjectConfigError(error)
        ? `Grape config is repairable but invalid: ${detail}`
        : `Grape config is unsupported: ${detail}`
    );
  }

  if (existsSync(layout.databasePath)) {
    try {
      const database = new DatabaseSync(layout.databasePath);
      try {
        const applied = readAppliedStorageMigrations(database);
        const plan = planPendingStorageMigrations(readStorageMigrationSources(), applied);
        appliedMigrations = applied.map((migration) => migration.id);
        pendingMigrations = plan.pending.map((migration) => migration.id);
      } finally {
        database.close();
      }
    } catch (error) {
      errors.push(`database check failed: ${errorMessage(error)}`);
    }
  }

  if (!existsSync(layout.grapeDirPath)) warnings.push("local .grape directory has not been created.");
  if (!existsSync(layout.configPath)) warnings.push("local .grape/config.json is missing.");
  if (config && path.resolve(config.project.rootPath) !== rootPath) {
    errors.push("Grape config root path does not match the current repository path.");
  }
  if (!existsSync(layout.databasePath)) warnings.push("local .grape/grape.db is missing.");
  if (pendingMigrations.length > 0 && existsSync(layout.databasePath)) {
    warnings.push("database has pending migrations; run grape init --connect.");
  }
  if (snapshot?.worktreeStatus === "dirty") {
    warnings.push("worktree is dirty; generated context will be worktree-scoped.");
  }

  const status: LocalProjectStatus = {
    rootPath,
    initialized:
      errors.length === 0 &&
      config !== undefined &&
      existsSync(layout.databasePath) &&
      pendingMigrations.length === 0,
    grapeDirPath: layout.grapeDirPath,
    configPath: layout.configPath,
    databasePath: layout.databasePath,
    config,
    databaseExists: existsSync(layout.databasePath),
    appliedMigrations,
    pendingMigrations,
    branch: snapshot?.branch,
    headCommit: snapshot?.commit,
    dirtyWorktree: snapshot ? snapshot.worktreeStatus !== "clean" : undefined,
    snapshotHash: snapshot?.snapshotHash,
    scan: scanDiagnosticsForSnapshot(snapshot),
    warnings,
    errors,
    recoveryGuidance: []
  };

  return {
    ...status,
    recoveryGuidance: recoveryGuidanceForStatus(status)
  };
}

function layoutForStatus(rootPath: string): LocalProjectLayout {
  return {
    rootPath,
    grapeDirPath: path.join(rootPath, ".grape"),
    configPath: path.join(rootPath, ".grape", "config.json"),
    databasePath: path.join(rootPath, ".grape", "grape.db"),
    artifactDirPath: path.join(rootPath, ".grape", "artifacts"),
    createdDirs: []
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
