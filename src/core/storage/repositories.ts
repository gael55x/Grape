import type { DatabaseSync } from "node:sqlite";

export interface ProjectRecord {
  readonly projectId: string;
  readonly rootPath: string;
  readonly grapeDirPath: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RepoRecord {
  readonly repoId: string;
  readonly projectId: string;
  readonly vcsType: string;
  readonly rootPath: string;
  readonly normalizedRootPath: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RepoSnapshotRecord {
  readonly snapshotId: string;
  readonly repoId: string;
  readonly branch: string;
  readonly commitSha: string;
  readonly worktreeHash: string;
  readonly snapshotHash: string;
  readonly dirtyState: "clean" | "dirty" | "unknown";
  readonly createdAt: string;
}

export interface WorktreeStateRecord {
  readonly worktreeStateId: string;
  readonly snapshotId: string;
  readonly state: "clean" | "dirty" | "unknown";
  readonly dirtyPathsJson: string;
  readonly createdAt: string;
}

export interface ContextSessionRecord {
  readonly sessionId: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly repoSnapshotId: string;
  readonly worktreeStateId: string;
  readonly agentName?: string;
  readonly agentSessionId?: string;
  readonly taskId?: string;
  readonly taskType?: string;
  readonly branchName: string;
  readonly baseCommitSha?: string;
  readonly headCommitSha: string;
  readonly status: "active" | "paused" | "completed" | "invalidated";
  readonly lockToken?: string;
  readonly lockStatus: "unlocked" | "locked" | "expired" | "contended";
  readonly startedAt: string;
  readonly lastSeenAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ContextArtifactRecord {
  readonly artifactId: string;
  readonly sessionId?: string;
  readonly snapshotId?: string;
  readonly artifactHash: string;
  readonly dependencyManifestHash: string;
  readonly taskType: string;
  readonly riskOverlaysJson: string;
  readonly warningsJson: string;
  readonly unsafeReasonsJson: string;
  readonly createdAt: string;
}

export interface ContextDependencyRecord {
  readonly dependencyId: string;
  readonly artifactId: string;
  readonly dependencyKind: string;
  readonly dependencyRef: string;
  readonly dependencyHash: string;
  readonly scopeJson: string;
  readonly createdAt: string;
}

export interface ContextSentItemRecord {
  readonly sentItemId: string;
  readonly sessionId: string;
  readonly artifactId: string;
  readonly sectionId: string;
  readonly taskId?: string;
  readonly itemKind: string;
  readonly itemRef: string;
  readonly itemHash: string;
  readonly contentHash: string;
  readonly branchName: string;
  readonly commitSha: string;
  readonly dependencyManifestHash: string;
  readonly wasPinned: boolean;
  readonly lastDiffState: string;
  readonly omitReason?: string;
  readonly restoreHint?: string;
  readonly sessionResetId?: string;
  readonly firstSentAt: string;
  readonly lastSentAt: string;
  readonly sendCount: number;
  readonly tokenCount: number;
}

export interface OmittedContextItemRecord {
  readonly omittedItemId: string;
  readonly sessionId: string;
  readonly artifactId: string;
  readonly sectionId: string;
  readonly itemKind: string;
  readonly itemRef: string;
  readonly itemHash: string;
  readonly contentHash: string;
  readonly reasonOmitted: string;
  readonly canRestore: boolean;
  readonly restoreId?: string;
  readonly restoreCommand?: string;
  readonly omittedAt: string;
}

export interface StorageRepositories {
  readonly projects: {
    insert(record: ProjectRecord): void;
  };
  readonly repos: {
    insert(record: RepoRecord): void;
  };
  readonly repoSnapshots: {
    insert(record: RepoSnapshotRecord): void;
  };
  readonly worktreeStates: {
    insert(record: WorktreeStateRecord): void;
  };
  readonly contextSessions: {
    insert(record: ContextSessionRecord): void;
    get(sessionId: string): ContextSessionRecord | undefined;
  };
  readonly contextArtifacts: {
    insert(record: ContextArtifactRecord): void;
    get(artifactId: string): ContextArtifactRecord | undefined;
  };
  readonly contextDependencies: {
    insert(record: ContextDependencyRecord): void;
    listByArtifact(artifactId: string): readonly ContextDependencyRecord[];
  };
  readonly contextSentItems: {
    insert(record: ContextSentItemRecord): void;
    listBySession(sessionId: string): readonly ContextSentItemRecord[];
  };
  readonly omittedContextItems: {
    insert(record: OmittedContextItemRecord): void;
    listBySession(sessionId: string): readonly OmittedContextItemRecord[];
  };
}

export function createStorageRepositories(database: DatabaseSync): StorageRepositories {
  return {
    projects: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO projects",
              "(project_id, root_path, grape_dir_path, created_at, updated_at)",
              "VALUES (?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(record.projectId, record.rootPath, record.grapeDirPath, record.createdAt, record.updatedAt);
      }
    },
    repos: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO repos",
              "(repo_id, project_id, vcs_type, root_path, normalized_root_path, created_at, updated_at)",
              "VALUES (?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.repoId,
            record.projectId,
            record.vcsType,
            record.rootPath,
            record.normalizedRootPath,
            record.createdAt,
            record.updatedAt
          );
      }
    },
    repoSnapshots: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO repo_snapshots",
              "(snapshot_id, repo_id, branch, commit_sha, worktree_hash, snapshot_hash, dirty_state, created_at)",
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.snapshotId,
            record.repoId,
            record.branch,
            record.commitSha,
            record.worktreeHash,
            record.snapshotHash,
            record.dirtyState,
            record.createdAt
          );
      }
    },
    worktreeStates: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO worktree_states",
              "(worktree_state_id, snapshot_id, state, dirty_paths_json, created_at)",
              "VALUES (?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.worktreeStateId,
            record.snapshotId,
            record.state,
            record.dirtyPathsJson,
            record.createdAt
          );
      }
    },
    contextSessions: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO context_sessions",
              [
                "(session_id, project_id, repo_id, repo_snapshot_id, worktree_state_id,",
                "agent_name, agent_session_id, task_id, task_type, branch_name, base_commit_sha,",
                "head_commit_sha, status, lock_token, lock_status, started_at, last_seen_at, created_at, updated_at)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.sessionId,
            record.projectId,
            record.repoId,
            record.repoSnapshotId,
            record.worktreeStateId,
            sqlNullable(record.agentName),
            sqlNullable(record.agentSessionId),
            sqlNullable(record.taskId),
            sqlNullable(record.taskType),
            record.branchName,
            sqlNullable(record.baseCommitSha),
            record.headCommitSha,
            record.status,
            sqlNullable(record.lockToken),
            record.lockStatus,
            record.startedAt,
            record.lastSeenAt,
            record.createdAt,
            record.updatedAt
          );
      },
      get(sessionId) {
        return mapContextSession(
          database
            .prepare("SELECT * FROM context_sessions WHERE session_id = ?")
            .get(sessionId) as Record<string, unknown> | undefined
        );
      }
    },
    contextArtifacts: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO context_artifacts",
              [
                "(artifact_id, session_id, snapshot_id, artifact_hash, dependency_manifest_hash,",
                "task_type, risk_overlays_json, warnings_json, unsafe_reasons_json, created_at)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.artifactId,
            sqlNullable(record.sessionId),
            sqlNullable(record.snapshotId),
            record.artifactHash,
            record.dependencyManifestHash,
            record.taskType,
            record.riskOverlaysJson,
            record.warningsJson,
            record.unsafeReasonsJson,
            record.createdAt
          );
      },
      get(artifactId) {
        return mapContextArtifact(
          database
            .prepare("SELECT * FROM context_artifacts WHERE artifact_id = ?")
            .get(artifactId) as Record<string, unknown> | undefined
        );
      }
    },
    contextDependencies: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO context_dependencies",
              "(dependency_id, artifact_id, dependency_kind, dependency_ref, dependency_hash, scope_json, created_at)",
              "VALUES (?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.dependencyId,
            record.artifactId,
            record.dependencyKind,
            record.dependencyRef,
            record.dependencyHash,
            record.scopeJson,
            record.createdAt
          );
      },
      listByArtifact(artifactId) {
        return (
          database
            .prepare("SELECT * FROM context_dependencies WHERE artifact_id = ? ORDER BY dependency_id ASC")
            .all(artifactId) as Array<Record<string, unknown>>
        ).map(mapContextDependency);
      }
    },
    contextSentItems: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO context_sent_items",
              [
                "(sent_item_id, session_id, artifact_id, section_id, task_id, item_kind, item_ref, item_hash,",
                "content_hash, branch_name, commit_sha, dependency_manifest_hash, was_pinned, last_diff_state,",
                "omit_reason, restore_hint, session_reset_id, first_sent_at, last_sent_at, send_count, token_count)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.sentItemId,
            record.sessionId,
            record.artifactId,
            record.sectionId,
            sqlNullable(record.taskId),
            record.itemKind,
            record.itemRef,
            record.itemHash,
            record.contentHash,
            record.branchName,
            record.commitSha,
            record.dependencyManifestHash,
            boolToInt(record.wasPinned),
            record.lastDiffState,
            sqlNullable(record.omitReason),
            sqlNullable(record.restoreHint),
            sqlNullable(record.sessionResetId),
            record.firstSentAt,
            record.lastSentAt,
            record.sendCount,
            record.tokenCount
          );
      },
      listBySession(sessionId) {
        return (
          database
            .prepare("SELECT * FROM context_sent_items WHERE session_id = ? ORDER BY sent_item_id ASC")
            .all(sessionId) as Array<Record<string, unknown>>
        ).map(mapContextSentItem);
      }
    },
    omittedContextItems: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO omitted_context_items",
              [
                "(omitted_item_id, session_id, artifact_id, section_id, item_kind, item_ref, item_hash,",
                "content_hash, reason_omitted, can_restore, restore_id, restore_command, omitted_at)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.omittedItemId,
            record.sessionId,
            record.artifactId,
            record.sectionId,
            record.itemKind,
            record.itemRef,
            record.itemHash,
            record.contentHash,
            record.reasonOmitted,
            boolToInt(record.canRestore),
            sqlNullable(record.restoreId),
            sqlNullable(record.restoreCommand),
            record.omittedAt
          );
      },
      listBySession(sessionId) {
        return (
          database
            .prepare("SELECT * FROM omitted_context_items WHERE session_id = ? ORDER BY omitted_item_id ASC")
            .all(sessionId) as Array<Record<string, unknown>>
        ).map(mapOmittedContextItem);
      }
    }
  };
}

function mapContextSession(row: Record<string, unknown> | undefined): ContextSessionRecord | undefined {
  if (!row) return undefined;
  return {
    sessionId: stringField(row, "session_id"),
    projectId: stringField(row, "project_id"),
    repoId: stringField(row, "repo_id"),
    repoSnapshotId: stringField(row, "repo_snapshot_id"),
    worktreeStateId: stringField(row, "worktree_state_id"),
    agentName: optionalStringField(row, "agent_name"),
    agentSessionId: optionalStringField(row, "agent_session_id"),
    taskId: optionalStringField(row, "task_id"),
    taskType: optionalStringField(row, "task_type"),
    branchName: stringField(row, "branch_name"),
    baseCommitSha: optionalStringField(row, "base_commit_sha"),
    headCommitSha: stringField(row, "head_commit_sha"),
    status: stringField(row, "status") as ContextSessionRecord["status"],
    lockToken: optionalStringField(row, "lock_token"),
    lockStatus: stringField(row, "lock_status") as ContextSessionRecord["lockStatus"],
    startedAt: stringField(row, "started_at"),
    lastSeenAt: stringField(row, "last_seen_at"),
    createdAt: stringField(row, "created_at"),
    updatedAt: stringField(row, "updated_at")
  };
}

function mapContextArtifact(row: Record<string, unknown> | undefined): ContextArtifactRecord | undefined {
  if (!row) return undefined;
  return {
    artifactId: stringField(row, "artifact_id"),
    sessionId: optionalStringField(row, "session_id"),
    snapshotId: optionalStringField(row, "snapshot_id"),
    artifactHash: stringField(row, "artifact_hash"),
    dependencyManifestHash: stringField(row, "dependency_manifest_hash"),
    taskType: stringField(row, "task_type"),
    riskOverlaysJson: stringField(row, "risk_overlays_json"),
    warningsJson: stringField(row, "warnings_json"),
    unsafeReasonsJson: stringField(row, "unsafe_reasons_json"),
    createdAt: stringField(row, "created_at")
  };
}

function mapContextDependency(row: Record<string, unknown>): ContextDependencyRecord {
  return {
    dependencyId: stringField(row, "dependency_id"),
    artifactId: stringField(row, "artifact_id"),
    dependencyKind: stringField(row, "dependency_kind"),
    dependencyRef: stringField(row, "dependency_ref"),
    dependencyHash: stringField(row, "dependency_hash"),
    scopeJson: stringField(row, "scope_json"),
    createdAt: stringField(row, "created_at")
  };
}

function mapContextSentItem(row: Record<string, unknown>): ContextSentItemRecord {
  return {
    sentItemId: stringField(row, "sent_item_id"),
    sessionId: stringField(row, "session_id"),
    artifactId: stringField(row, "artifact_id"),
    sectionId: stringField(row, "section_id"),
    taskId: optionalStringField(row, "task_id"),
    itemKind: stringField(row, "item_kind"),
    itemRef: stringField(row, "item_ref"),
    itemHash: stringField(row, "item_hash"),
    contentHash: stringField(row, "content_hash"),
    branchName: stringField(row, "branch_name"),
    commitSha: stringField(row, "commit_sha"),
    dependencyManifestHash: stringField(row, "dependency_manifest_hash"),
    wasPinned: intToBool(row.was_pinned),
    lastDiffState: stringField(row, "last_diff_state"),
    omitReason: optionalStringField(row, "omit_reason"),
    restoreHint: optionalStringField(row, "restore_hint"),
    sessionResetId: optionalStringField(row, "session_reset_id"),
    firstSentAt: stringField(row, "first_sent_at"),
    lastSentAt: stringField(row, "last_sent_at"),
    sendCount: numberField(row, "send_count"),
    tokenCount: numberField(row, "token_count")
  };
}

function mapOmittedContextItem(row: Record<string, unknown>): OmittedContextItemRecord {
  return {
    omittedItemId: stringField(row, "omitted_item_id"),
    sessionId: stringField(row, "session_id"),
    artifactId: stringField(row, "artifact_id"),
    sectionId: stringField(row, "section_id"),
    itemKind: stringField(row, "item_kind"),
    itemRef: stringField(row, "item_ref"),
    itemHash: stringField(row, "item_hash"),
    contentHash: stringField(row, "content_hash"),
    reasonOmitted: stringField(row, "reason_omitted"),
    canRestore: intToBool(row.can_restore),
    restoreId: optionalStringField(row, "restore_id"),
    restoreCommand: optionalStringField(row, "restore_command"),
    omittedAt: stringField(row, "omitted_at")
  };
}

function stringField(row: Record<string, unknown>, key: string): string {
  return String(row[key]);
}

function optionalStringField(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  return value === null || value === undefined ? undefined : String(value);
}

function numberField(row: Record<string, unknown>, key: string): number {
  return Number(row[key]);
}

function boolToInt(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

function intToBool(value: unknown): boolean {
  return Number(value) === 1;
}

function sqlNullable(value: string | undefined): string | null {
  return value ?? null;
}
