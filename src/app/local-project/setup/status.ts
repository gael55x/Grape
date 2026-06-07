import { existsSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { createGitRepoSnapshot, type RepoSnapshot } from "../../../core/git/index.js";
import {
  createStorageRepositories,
  planPendingStorageMigrations,
  readAppliedStorageMigrations,
  storageMigrationReferences
} from "../../../core/storage/index.js";
import type { ContextSessionRecord, StorageRepositories } from "../../../core/storage/index.js";
import {
  isRepairableLocalProjectConfigError,
  readLocalProjectConfig,
  type LocalProjectConfig,
  type LocalProjectLayout
} from "./config.js";
import { recoveryGuidanceForStatus } from "./recovery.js";
import { scanDiagnosticsForSnapshot } from "./scan-diagnostics.js";
import { readStorageMigrationSources } from "./storage.js";
import type {
  ContextFreshnessStatus,
  LocalContextFreshness,
  LocalProjectStatus,
  LocalSessionFreshnessSummary,
  LocalStatusSessionFreshness,
  PublicLocalProjectStatus
} from "./setup-types.js";

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

export function readPublicLocalProjectStatus(rootPathInput: string, now = new Date().toISOString()): PublicLocalProjectStatus {
  const setup = readLocalProjectStatus(rootPathInput);
  const sessionFreshness = readSessionFreshness(setup);
  const freshness = contextFreshness({ setup, sessionFreshness, now });
  const refreshRecommendations = refreshRecommendationsForStatus(setup, freshness, sessionFreshness);

  return {
    rootPath: setup.rootPath,
    grapeDirPath: setup.grapeDirPath,
    configPath: setup.configPath,
    databasePath: setup.databasePath,
    status: freshness.status,
    freshness,
    initialized: setup.initialized,
    configPresent: setup.config !== undefined,
    databaseExists: setup.databaseExists,
    databaseReady: setup.databaseExists && setup.pendingMigrations.length === 0 && !hasDatabaseError(setup),
    migrationStatus: setup.databaseExists
      ? setup.pendingMigrations.length === 0 && !hasDatabaseError(setup)
        ? "current"
        : "pending"
      : "unknown",
    appliedMigrations: setup.appliedMigrations,
    pendingMigrations: setup.pendingMigrations,
    branch: setup.branch,
    headCommit: setup.headCommit,
    dirtyWorktree: setup.dirtyWorktree,
    snapshotHash: setup.snapshotHash,
    scan: setup.scan,
    sessionFreshness,
    warnings: setup.warnings,
    errors: setup.errors,
    recoveryGuidance: setup.recoveryGuidance,
    refreshRecommendations
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

function readSessionFreshness(setup: LocalProjectStatus): LocalStatusSessionFreshness {
  if (!setup.initialized || !setup.branch || !setup.headCommit) return emptySessionFreshness();

  try {
    const database = new DatabaseSync(setup.databasePath);
    try {
      const repositories = createStorageRepositories(database);
      const sessions = repositories.contextSessions.list();
      const summaries = sessions.map((session) => sessionFreshnessSummary(repositories, session, setup));
      const staleItemCount = summaries.reduce(
        (count, session) =>
          count + repositories.contextPackItems.listInvalidatedSentItemIdsBySession(session.sessionId).length,
        0
      );
      return {
        inspectedSessionCount: summaries.length,
        activeSessionCount: summaries.filter((session) => session.sessionStatus === "active").length,
        freshSessionCount: summaries.filter((session) => session.status === "fresh").length,
        staleSessionCount: summaries.filter((session) => session.status === "stale").length,
        partialSessionCount: summaries.filter((session) => session.status === "partial").length,
        unsafeSessionCount: summaries.filter((session) => session.status === "unsafe").length,
        unknownSessionCount: summaries.filter((session) => session.status === "unknown").length,
        staleItemCount,
        sessions: summaries
      };
    } finally {
      database.close();
    }
  } catch {
    return emptySessionFreshness();
  }
}

function sessionFreshnessSummary(
  repositories: StorageRepositories,
  session: ContextSessionRecord,
  setup: LocalProjectStatus
): LocalSessionFreshnessSummary {
  const artifacts = repositories.contextArtifacts.listBySession(session.sessionId);
  const latestArtifact = artifacts[0];
  const artifactWarnings = latestArtifact ? parseJsonStringArray(latestArtifact.warningsJson) : [];
  const artifactUnsafeReasons = latestArtifact ? parseJsonStringArray(latestArtifact.unsafeReasonsJson) : [];
  const invalidatedItemCount = repositories.contextPackItems.listInvalidatedSentItemIdsBySession(session.sessionId).length;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!latestArtifact) reasons.push("session_has_no_context_artifact");
  if (session.branchName !== setup.branch || session.headCommitSha !== setup.headCommit) {
    reasons.push("session_branch_or_head_stale");
  }
  if (invalidatedItemCount > 0) {
    reasons.push("stale_context_invalidations_present");
    warnings.push("stale_context_invalidations_present");
  }
  if (setup.dirtyWorktree) {
    reasons.push("dirty_worktree");
    warnings.push("dirty_worktree_context");
  }
  if (artifactUnsafeReasons.length > 0) {
    reasons.push("artifact_has_unsafe_reasons");
    warnings.push(...artifactUnsafeReasons.map((reason) => `unsafe:${reason}`));
  }
  const partialWarnings = artifactWarnings.filter(isPartialAnalysisWarning);
  if (partialWarnings.length > 0) {
    reasons.push("partial_analysis_warnings_present");
    warnings.push(...partialWarnings);
  }

  return {
    sessionId: session.sessionId,
    status: freshnessStatusForReasons(reasons),
    reasons,
    warnings: uniqueStrings(warnings),
    sessionStatus: session.status,
    lockStatus: session.lockStatus,
    branchName: session.branchName,
    headCommitSha: session.headCommitSha,
    taskType: session.taskType,
    lastSeenAt: session.lastSeenAt,
    latestArtifactId: latestArtifact?.artifactId
  };
}

function contextFreshness(input: {
  readonly setup: LocalProjectStatus;
  readonly sessionFreshness: LocalStatusSessionFreshness;
  readonly now: string;
}): LocalContextFreshness {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (input.setup.errors.length > 0) reasons.push("status_errors_present");
  if (!input.setup.initialized) reasons.push("local_project_not_initialized");
  if (!input.setup.branch || !input.setup.headCommit) reasons.push("git_state_unknown");
  if (input.setup.pendingMigrations.length > 0) reasons.push("pending_migrations");
  if (input.setup.dirtyWorktree) {
    reasons.push("dirty_worktree");
    warnings.push("dirty_worktree_context");
  }
  if (input.sessionFreshness.inspectedSessionCount === 0) reasons.push("no_session_context_observed");
  if (input.sessionFreshness.staleItemCount > 0 || input.sessionFreshness.staleSessionCount > 0) {
    reasons.push("stale_session_context_present");
    warnings.push("stale_context_invalidations_present");
  }
  if (input.sessionFreshness.partialSessionCount > 0) {
    reasons.push("partial_session_context_present");
  }
  if (input.sessionFreshness.unsafeSessionCount > 0) {
    reasons.push("unsafe_session_context_present");
  }
  warnings.push(...input.sessionFreshness.sessions.flatMap((session) => session.warnings));

  const status = overallFreshnessStatus(input.setup, input.sessionFreshness, reasons);
  return {
    status,
    reasons: uniqueStrings(reasons),
    warnings: uniqueStrings(warnings),
    checkedAt: input.now,
    refreshRecommended: status !== "fresh"
  };
}

function overallFreshnessStatus(
  setup: LocalProjectStatus,
  sessionFreshness: LocalStatusSessionFreshness,
  reasons: readonly string[]
): ContextFreshnessStatus {
  if (setup.errors.length > 0 || sessionFreshness.unsafeSessionCount > 0) return "unsafe";
  if (sessionFreshness.staleItemCount > 0 || sessionFreshness.staleSessionCount > 0) return "stale";
  if (setup.dirtyWorktree || sessionFreshness.partialSessionCount > 0) return "partial";
  if (!setup.initialized || reasons.includes("git_state_unknown") || sessionFreshness.inspectedSessionCount === 0) {
    return "unknown";
  }
  return "fresh";
}

function refreshRecommendationsForStatus(
  setup: LocalProjectStatus,
  freshness: LocalContextFreshness,
  sessionFreshness: LocalStatusSessionFreshness
): readonly string[] {
  const recommendations = new Set<string>();

  for (const guidance of setup.recoveryGuidance) recommendations.add(guidance);
  if (!setup.initialized) {
    recommendations.add("Run grape init --connect from the repository root to bootstrap or repair local state.");
  }
  if (sessionFreshness.inspectedSessionCount === 0) {
    recommendations.add("Call grape_get_context or run grape compile --task <text> --session <id> --json to create session context.");
  }
  if (freshness.status === "stale") {
    recommendations.add("Call grape_get_context or rerun grape compile for fresh context before using prior session context.");
  }
  if (freshness.status === "partial" && setup.dirtyWorktree) {
    recommendations.add("Commit or stash changes for branch-global context, or continue with worktree-scoped context.");
  }
  if (freshness.status === "unsafe") {
    recommendations.add("Inspect status errors before relying on existing Grape context.");
  }

  return [...recommendations];
}

function freshnessStatusForReasons(reasons: readonly string[]): ContextFreshnessStatus {
  if (reasons.includes("artifact_has_unsafe_reasons")) return "unsafe";
  if (reasons.includes("session_branch_or_head_stale") || reasons.includes("stale_context_invalidations_present")) {
    return "stale";
  }
  if (reasons.includes("dirty_worktree") || reasons.includes("partial_analysis_warnings_present")) return "partial";
  if (reasons.includes("session_has_no_context_artifact")) return "unknown";
  return "fresh";
}

function emptySessionFreshness(): LocalStatusSessionFreshness {
  return {
    inspectedSessionCount: 0,
    activeSessionCount: 0,
    freshSessionCount: 0,
    staleSessionCount: 0,
    partialSessionCount: 0,
    unsafeSessionCount: 0,
    unknownSessionCount: 0,
    staleItemCount: 0,
    sessions: []
  };
}

function parseJsonStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function isPartialAnalysisWarning(value: string): boolean {
  return (
    value.includes("partial") ||
    value.includes("unsupported") ||
    value.includes("lightweight_index") ||
    value.includes("fallback") ||
    value.includes("no_related_tests_found")
  );
}

function hasDatabaseError(status: LocalProjectStatus): boolean {
  return status.errors.some((error) => error.startsWith("database check failed"));
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
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
