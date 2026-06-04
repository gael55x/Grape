import { existsSync, lstatSync, realpathSync } from "node:fs";
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
  const layoutStatus = validateExistingStatusLayout(rootPath, layout, errors);

  if (layoutStatus.configReadable) {
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
  }

  if (layoutStatus.databaseReadable && existsSync(layout.databasePath)) {
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
      layoutStatus.databaseReadable &&
      existsSync(layout.databasePath) &&
      pendingMigrations.length === 0,
    grapeDirPath: layout.grapeDirPath,
    configPath: layout.configPath,
    databasePath: layout.databasePath,
    config,
    databaseExists: layoutStatus.databaseReadable && existsSync(layout.databasePath),
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

function validateExistingStatusLayout(
  rootPath: string,
  layout: LocalProjectLayout,
  errors: string[]
): { readonly configReadable: boolean; readonly databaseReadable: boolean } {
  const grapeDirSafe = validateExistingLocalDirectory(rootPath, layout.grapeDirPath, ".grape", errors);
  const configSafe =
    grapeDirSafe && validateExistingLocalStateFile(layout.configPath, ".grape/config.json", errors);
  const databaseSafe =
    grapeDirSafe && validateExistingLocalStateFile(layout.databasePath, ".grape/grape.db", errors);
  return {
    configReadable: grapeDirSafe && configSafe,
    databaseReadable: grapeDirSafe && databaseSafe
  };
}

function validateExistingLocalDirectory(
  rootPath: string,
  absoluteDir: string,
  relativeDir: string,
  errors: string[]
): boolean {
  if (!existsSync(absoluteDir)) return true;
  try {
    const stat = lstatSync(absoluteDir);
    if (stat.isSymbolicLink()) {
      errors.push(`Grape local directory must not be a symlink: ${relativeDir}`);
      return false;
    }
    if (!stat.isDirectory()) {
      errors.push(`Grape local path must be a directory: ${relativeDir}`);
      return false;
    }
    const realRoot = realpathSync(rootPath);
    const realDir = realpathSync(absoluteDir);
    if (!isInsideOrSame(realRoot, realDir)) {
      errors.push(`Grape local directory escaped the repository root: ${relativeDir}`);
      return false;
    }
    return true;
  } catch {
    errors.push(`Grape local directory could not be inspected safely: ${relativeDir}`);
    return false;
  }
}

function validateExistingLocalStateFile(absolutePath: string, relativePath: string, errors: string[]): boolean {
  if (!existsSync(absolutePath)) return true;
  try {
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      errors.push(`Grape local state file must not be a symlink: ${relativePath}`);
      return false;
    }
    if (!stat.isFile()) {
      errors.push(`Grape local state path must be a file: ${relativePath}`);
      return false;
    }
    return true;
  } catch {
    errors.push(`Grape local state path could not be inspected safely: ${relativePath}`);
    return false;
  }
}

function isInsideOrSame(rootPath: string, absolutePath: string): boolean {
  const relativePath = path.relative(rootPath, absolutePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
