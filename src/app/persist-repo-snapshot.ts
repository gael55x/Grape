import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import type { RepoSnapshot } from "../core/git/index.js";
import { createGitRepoSnapshot } from "../core/git/index.js";
import { collectRepoSnapshotEvidence } from "../core/evidence/index.js";
import type {
  EvidenceStorageRepositories,
  IndexingStorageRepositories,
  ProjectRecord,
  RepoRecord,
  RepoSnapshotRecord,
  StorageRepositories,
  WorktreeStateRecord
} from "../core/storage/index.js";
import { runStorageTransaction } from "../core/storage/index.js";
import { persistFileIndex } from "./persist-file-index.js";
import { persistSnapshotEvidence } from "./persist-snapshot-evidence.js";

export interface PersistGitRepoSnapshotInput {
  readonly database: DatabaseSync;
  readonly repositories: StorageRepositories;
  readonly evidenceRepositories: EvidenceStorageRepositories;
  readonly indexingRepositories: IndexingStorageRepositories;
  readonly rootPath: string;
  readonly snapshot?: RepoSnapshot;
  readonly now: string;
  readonly projectId?: string;
  readonly repoId?: string;
  readonly gitBinary?: string;
}

export interface PersistGitRepoSnapshotResult {
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly snapshot: RepoSnapshot;
  readonly inserted: {
    readonly project: boolean;
    readonly repo: boolean;
    readonly repoSnapshot: boolean;
    readonly worktreeState: boolean;
  };
  readonly evidence: {
    readonly sourcesInserted: number;
    readonly sourceRejectionsInserted: number;
    readonly sourcesSeen: number;
    readonly sourceRejectionsSeen: number;
  };
  readonly index: {
    readonly nodesInserted: number;
    readonly nodesSeen: number;
    readonly edgesInserted: number;
    readonly edgesSeen: number;
    readonly ftsEntriesInserted: number;
    readonly ftsEntriesSeen: number;
    readonly skippedFiles: number;
    readonly ftsSkippedSources: number;
  };
}

export function persistGitRepoSnapshot(input: PersistGitRepoSnapshotInput): PersistGitRepoSnapshotResult {
  const snapshot = input.snapshot ?? createGitRepoSnapshot({
    rootPath: input.rootPath,
    repoId: input.repoId,
    gitBinary: input.gitBinary,
    createdAt: input.now
  });
  assertSnapshotMatchesInput(input, snapshot);
  const projectId = input.projectId ?? `project:${snapshot.repoId.replace(/^repo:/, "")}`;
  const worktreeStateId = `${snapshot.snapshotId}:worktree`;

  return runStorageTransaction(input.database, () => {
    const project = ensureProject(input.repositories, projectRecord(projectId, snapshot.rootPath, input.now));
    const repo = ensureRepo(input.repositories, repoRecord(snapshot, projectId, input.now));
    const repoSnapshot = ensureRepoSnapshot(input.repositories, repoSnapshotRecord(snapshot, input.now));
    const worktreeState = ensureWorktreeState(
      input.repositories,
      worktreeStateRecord(snapshot, worktreeStateId, input.now)
    );
    const snapshotAlreadyMaterialized = !repoSnapshot && !worktreeState;
    const evidence = snapshotAlreadyMaterialized && existingEvidenceIsComplete({
      repositories: input.evidenceRepositories,
      projectId,
      worktreeStateId,
      snapshot,
      now: input.now
    })
      ? existingEvidenceResult({ projectId, worktreeStateId, snapshot, now: input.now })
      : persistSnapshotEvidence({
          repositories: input.evidenceRepositories,
          projectId,
          worktreeStateId,
          snapshot,
          now: input.now
        });
    const index = snapshotAlreadyMaterialized && existingIndexIsPresent(input.indexingRepositories, snapshot)
      ? existingIndexResult(input.indexingRepositories, snapshot)
      : persistFileIndex({
          evidenceRepositories: input.evidenceRepositories,
          indexingRepositories: input.indexingRepositories,
          projectId,
          snapshot,
          now: input.now
        });

    return {
      projectId,
      repoId: snapshot.repoId,
      snapshotId: snapshot.snapshotId,
      worktreeStateId,
      snapshot,
      inserted: {
        project,
        repo,
        repoSnapshot,
        worktreeState
      },
      evidence,
      index
    };
  });
}

function assertSnapshotMatchesInput(input: PersistGitRepoSnapshotInput, snapshot: RepoSnapshot): void {
  if (input.snapshot && path.resolve(input.rootPath) !== snapshot.rootPath) {
    throw new Error("provided repo snapshot root path does not match persist input");
  }
  if (input.snapshot && input.repoId && input.repoId !== snapshot.repoId) {
    throw new Error("provided repo snapshot repo id does not match persist input");
  }
}

function existingEvidenceIsComplete(input: {
  readonly repositories: EvidenceStorageRepositories;
  readonly projectId: string;
  readonly worktreeStateId: string;
  readonly snapshot: RepoSnapshot;
  readonly now: string;
}): boolean {
  const expected = collectEvidenceForSnapshot(input);
  if (input.repositories.sources.listBySnapshot(input.snapshot.snapshotId).length !== expected.sources.length) {
    return false;
  }
  return expected.sourceRejections.every((rejection) =>
    Boolean(input.repositories.sourceRejections.get(rejection.rejectionId))
  );
}

function existingEvidenceResult(input: {
  readonly projectId: string;
  readonly worktreeStateId: string;
  readonly snapshot: RepoSnapshot;
  readonly now: string;
}): PersistGitRepoSnapshotResult["evidence"] {
  const expected = collectEvidenceForSnapshot(input);
  return {
    sourcesInserted: 0,
    sourceRejectionsInserted: 0,
    sourcesSeen: expected.sources.length,
    sourceRejectionsSeen: expected.sourceRejections.length
  };
}

function collectEvidenceForSnapshot(input: {
  readonly projectId: string;
  readonly worktreeStateId: string;
  readonly snapshot: RepoSnapshot;
  readonly now: string;
}) {
  return collectRepoSnapshotEvidence({
    projectId: input.projectId,
    repoId: input.snapshot.repoId,
    snapshotId: input.snapshot.snapshotId,
    worktreeStateId: input.worktreeStateId,
    branch: input.snapshot.branch,
    commit: input.snapshot.commit,
    worktreeHash: input.snapshot.worktreeHash,
    dirtyPaths: input.snapshot.dirtyPaths,
    dirtyPathScopes: input.snapshot.dirtyPathScopes,
    files: input.snapshot.files,
    rejectedFiles: input.snapshot.rejectedFiles,
    capturedAt: input.now
  });
}

function existingIndexIsPresent(
  repositories: IndexingStorageRepositories,
  snapshot: RepoSnapshot
): boolean {
  if (snapshot.files.length === 0) return true;
  const expectsSymbolIndex = snapshot.files.some((file) => sourceKindHasSymbolIndex(file.sourceKind));
  const expectsLexicalIndex = snapshot.files.length > 0;
  const symbolIndexPresent = repositories.symbolNodes.countBySnapshot(snapshot.snapshotId) > 0;
  const lexicalIndexPresent = repositories.ftsEntries.countBySnapshot(snapshot.snapshotId) > 0;
  return (
    (!expectsSymbolIndex || symbolIndexPresent) &&
    (!expectsLexicalIndex || lexicalIndexPresent)
  );
}

function sourceKindHasSymbolIndex(sourceKind: string): boolean {
  return (
    sourceKind === "source" ||
    sourceKind === "test" ||
    sourceKind === "config" ||
    sourceKind === "package" ||
    sourceKind === "rule"
  );
}

function existingIndexResult(
  repositories: IndexingStorageRepositories,
  snapshot: RepoSnapshot
): PersistGitRepoSnapshotResult["index"] {
  const nodesSeen = repositories.symbolNodes.countBySnapshot(snapshot.snapshotId);
  const edgesSeen = repositories.symbolEdges.countBySnapshot(snapshot.snapshotId);
  const ftsEntriesSeen = repositories.ftsEntries.countBySnapshot(snapshot.snapshotId);
  return {
    nodesInserted: 0,
    nodesSeen,
    edgesInserted: 0,
    edgesSeen,
    ftsEntriesInserted: 0,
    ftsEntriesSeen,
    skippedFiles: 0,
    ftsSkippedSources: 0
  };
}

function ensureProject(repositories: StorageRepositories, record: ProjectRecord): boolean {
  const existing = repositories.projects.get(record.projectId);
  if (existing) {
    assertMatchingRecord("project root", existing.rootPath, record.rootPath);
    assertMatchingRecord("project grape dir", existing.grapeDirPath, record.grapeDirPath);
    return false;
  }

  repositories.projects.insert(record);
  return true;
}

function ensureRepo(repositories: StorageRepositories, record: RepoRecord): boolean {
  const existing = repositories.repos.get(record.repoId);
  if (existing) {
    assertMatchingRecord("repo project", existing.projectId, record.projectId);
    assertMatchingRecord("repo root", existing.rootPath, record.rootPath);
    assertMatchingRecord("repo normalized root", existing.normalizedRootPath, record.normalizedRootPath);
    return false;
  }

  repositories.repos.insert(record);
  return true;
}

function ensureRepoSnapshot(repositories: StorageRepositories, record: RepoSnapshotRecord): boolean {
  const existing = repositories.repoSnapshots.get(record.snapshotId);
  if (existing) {
    assertMatchingRecord("snapshot repo", existing.repoId, record.repoId);
    assertMatchingRecord("snapshot hash", existing.snapshotHash, record.snapshotHash);
    assertMatchingRecord("snapshot worktree hash", existing.worktreeHash, record.worktreeHash);
    return false;
  }

  repositories.repoSnapshots.insert(record);
  return true;
}

function ensureWorktreeState(repositories: StorageRepositories, record: WorktreeStateRecord): boolean {
  const existing = repositories.worktreeStates.get(record.worktreeStateId);
  if (existing) {
    assertMatchingRecord("worktree snapshot", existing.snapshotId, record.snapshotId);
    assertMatchingRecord("worktree state", existing.state, record.state);
    assertMatchingRecord("worktree dirty paths", existing.dirtyPathsJson, record.dirtyPathsJson);
    return false;
  }

  repositories.worktreeStates.insert(record);
  return true;
}

function projectRecord(projectId: string, rootPath: string, now: string): ProjectRecord {
  return {
    projectId,
    rootPath,
    grapeDirPath: path.join(rootPath, ".grape"),
    createdAt: now,
    updatedAt: now
  };
}

function repoRecord(snapshot: RepoSnapshot, projectId: string, now: string): RepoRecord {
  return {
    repoId: snapshot.repoId,
    projectId,
    vcsType: "git",
    rootPath: snapshot.rootPath,
    normalizedRootPath: normalizePersistedPath(snapshot.rootPath),
    createdAt: now,
    updatedAt: now
  };
}

function repoSnapshotRecord(snapshot: RepoSnapshot, now: string): RepoSnapshotRecord {
  return {
    snapshotId: snapshot.snapshotId,
    repoId: snapshot.repoId,
    branch: snapshot.branch,
    commitSha: snapshot.commit,
    worktreeHash: snapshot.worktreeHash,
    snapshotHash: snapshot.snapshotHash,
    dirtyState: snapshot.worktreeStatus,
    createdAt: now
  };
}

function worktreeStateRecord(
  snapshot: RepoSnapshot,
  worktreeStateId: string,
  now: string
): WorktreeStateRecord {
  return {
    worktreeStateId,
    snapshotId: snapshot.snapshotId,
    state: snapshot.worktreeStatus,
    dirtyPathsJson: JSON.stringify(snapshot.dirtyPaths),
    createdAt: now
  };
}

function normalizePersistedPath(inputPath: string): string {
  return path.resolve(inputPath).replace(/\\/g, "/");
}

function assertMatchingRecord(label: string, existing: string, next: string): void {
  if (existing !== next) {
    throw new Error(`${label} mismatch while persisting repo snapshot`);
  }
}
