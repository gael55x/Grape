import type { DatabaseSync } from "node:sqlite";

import type { DiffState, TaskType } from "../../shared/contracts.js";
import { createContextArtifactStorageRepositories } from "./context-artifact/repositories.js";
import { createContextLedgerStorageRepositories } from "./context-ledger/repositories.js";
import { createProjectStorageRepositories } from "./project/repositories.js";
import { createSessionStorageRepositories } from "./session/repositories.js";
import { applySqliteConnectionPolicy } from "./sqlite-policy.js";

export type ContextDependencyKind =
  | "file"
  | "repo_snapshot"
  | "worktree_state"
  | "source"
  | "claim"
  | "proof"
  | "rule"
  | "config"
  | "lockfile"
  | "symbol"
  | "test"
  | "compression_artifact"
  | "session_ledger";

export type ContextPackItemKind =
  | "claim"
  | "proof"
  | "code_span"
  | "rule"
  | "test_output"
  | "symbol_summary"
  | "compression_artifact"
  | "open_question"
  | "context_summary"
  | "invalidation"
  | "restore_hint";

export type OmittedContextReason =
  | "unchanged_restorable"
  | "not_relevant"
  | "unsafe_to_send"
  | "blocked_by_policy";

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
  readonly taskType?: TaskType;
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
  readonly sessionId: string;
  readonly snapshotId: string;
  readonly artifactHash: string;
  readonly dependencyManifestHash: string;
  readonly taskType: TaskType;
  readonly riskOverlaysJson: string;
  readonly warningsJson: string;
  readonly unsafeReasonsJson: string;
  readonly createdAt: string;
}

export interface ContextDependencyRecord {
  readonly dependencyId: string;
  readonly artifactId: string;
  readonly dependencyKind: ContextDependencyKind;
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
  readonly itemKind: ContextPackItemKind;
  readonly itemRef: string;
  readonly itemHash: string;
  readonly contentHash: string;
  readonly branchName: string;
  readonly commitSha: string;
  readonly dependencyManifestHash: string;
  readonly wasPinned: boolean;
  readonly lastDiffState: DiffState;
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
  readonly itemKind: ContextPackItemKind;
  readonly itemRef: string;
  readonly itemHash: string;
  readonly contentHash: string;
  readonly branchName: string;
  readonly commitSha: string;
  readonly dependencyManifestHash: string;
  readonly lastDiffState: DiffState;
  readonly reasonOmitted: OmittedContextReason;
  readonly canRestore: boolean;
  readonly restoreId?: string;
  readonly restoreCommand?: string;
  readonly omittedAt: string;
  readonly sendCount: number;
  readonly tokenCount: number;
}

export interface SessionEventRecord {
  readonly eventId: string;
  readonly sessionId: string;
  readonly eventType: string;
  readonly reason: string;
  readonly metadataJson: string;
  readonly createdAt: string;
}

export interface ContextPackItemRecord {
  readonly packItemId: string;
  readonly sessionId: string;
  readonly artifactId: string;
  readonly sectionId?: string;
  readonly diffState: DiffState;
  readonly itemKind: ContextPackItemKind;
  readonly itemRef: string;
  readonly contentHash: string;
  readonly tokenCount: number;
  readonly pinned: boolean;
  readonly safetyCritical: boolean;
  readonly invalidatesSentItemId?: string;
  readonly restoreId?: string;
  readonly inputRefsJson: string;
  readonly createdAt: string;
}

export interface SessionLockUpdate {
  readonly sessionId: string;
  readonly lockToken: string;
  readonly now: string;
}

export interface SessionLockExpireUpdate {
  readonly sessionId: string;
  readonly expectedLockToken?: string;
  readonly now: string;
}

export interface ContextSessionCompileStateUpdate {
  readonly sessionId: string;
  readonly repoSnapshotId: string;
  readonly worktreeStateId: string;
  readonly branchName: string;
  readonly baseCommitSha?: string;
  readonly headCommitSha: string;
  readonly status: "active" | "paused" | "completed" | "invalidated";
  readonly now: string;
}

export interface StorageRepositories {
  readonly projects: {
    insert(record: ProjectRecord): void;
    get(projectId: string): ProjectRecord | undefined;
  };
  readonly repos: {
    insert(record: RepoRecord): void;
    get(repoId: string): RepoRecord | undefined;
  };
  readonly repoSnapshots: {
    insert(record: RepoSnapshotRecord): void;
    get(snapshotId: string): RepoSnapshotRecord | undefined;
  };
  readonly worktreeStates: {
    insert(record: WorktreeStateRecord): void;
    get(worktreeStateId: string): WorktreeStateRecord | undefined;
  };
  readonly contextSessions: {
    insert(record: ContextSessionRecord): void;
    get(sessionId: string): ContextSessionRecord | undefined;
    list(): readonly ContextSessionRecord[];
    acquireLock(update: SessionLockUpdate): boolean;
    renewLock(update: SessionLockUpdate): boolean;
    releaseLock(update: SessionLockUpdate): boolean;
    expireLock(update: SessionLockExpireUpdate): boolean;
    updateCompileState(update: ContextSessionCompileStateUpdate): boolean;
  };
  readonly sessionEvents: {
    insert(record: SessionEventRecord): void;
    listBySession(sessionId: string): readonly SessionEventRecord[];
  };
  readonly contextArtifacts: {
    insert(record: ContextArtifactRecord): void;
    get(artifactId: string): ContextArtifactRecord | undefined;
    list(): readonly ContextArtifactRecord[];
    listBySession(sessionId: string): readonly ContextArtifactRecord[];
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
    getBySessionAndRestoreId(sessionId: string, restoreId: string): OmittedContextItemRecord | undefined;
  };
  readonly contextPackItems: {
    insert(record: ContextPackItemRecord): void;
    listBySession(sessionId: string): readonly ContextPackItemRecord[];
  };
}

export function createStorageRepositories(database: DatabaseSync): StorageRepositories {
  applySqliteConnectionPolicy(database);

  return {
    ...createProjectStorageRepositories(database),
    ...createSessionStorageRepositories(database),
    ...createContextArtifactStorageRepositories(database),
    ...createContextLedgerStorageRepositories(database)
  };
}
