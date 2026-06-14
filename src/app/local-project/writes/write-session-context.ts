import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { createGitRepoSnapshot } from "../../../core/git/index.js";
import {
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createStorageRepositories
} from "../../../core/storage/index.js";
import { persistGitRepoSnapshot } from "../../persist-repo-snapshot.js";
import { ensureLocalProjectBootstrapped } from "../setup/bootstrap.js";
import { ensureConfiguredLocalProjectLayout } from "../setup/configured-layout.js";
import { assertSafeId } from "../context/compile-ids.js";
import { withMigratedLocalDatabase } from "../setup/storage.js";

export interface CurrentLocalContextSession {
  readonly rootPath: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
}

export interface CurrentLocalContextSessionInput {
  readonly rootPath: string;
  readonly sessionId: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
  readonly missingSessionMessage: string;
  readonly staleSessionMessage: string;
}

export function withCurrentLocalContextSession<T>(
  input: CurrentLocalContextSessionInput,
  operation: (input: { readonly database: DatabaseSync; readonly context: CurrentLocalContextSession }) => T
): { readonly context: CurrentLocalContextSession; readonly value: T } {
  const now = input.now ?? new Date().toISOString();
  const rootPath = path.resolve(input.rootPath);
  assertSafeId("session id", input.sessionId);

  ensureLocalProjectBootstrapped({
    rootPath,
    now,
    gitBinary: input.gitBinary,
    migrationsDir: input.migrationsDir
  });

  const snapshot = createGitRepoSnapshot({ rootPath, createdAt: now, gitBinary: input.gitBinary });
  const { layout, config } = ensureConfiguredLocalProjectLayout(snapshot.rootPath);

  return withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database) {
      const repositories = createStorageRepositories(database);
      const evidenceRepositories = createEvidenceStorageRepositories(database);
      const indexingRepositories = createIndexingStorageRepositories(database);
      const snapshotResult = persistGitRepoSnapshot({
        database,
        repositories,
        evidenceRepositories,
        indexingRepositories,
        rootPath: snapshot.rootPath,
        snapshot,
        projectId: config.project.projectId,
        repoId: config.project.repoId,
        gitBinary: input.gitBinary,
        now
      });
      const session = repositories.contextSessions.get(input.sessionId);
      if (!session) throw new Error(input.missingSessionMessage);
      if (session.repoId !== config.project.repoId) throw new Error("context session repo does not match this project.");
      if (
        session.branchName !== snapshotResult.snapshot.branch ||
        session.headCommitSha !== snapshotResult.snapshot.commit ||
        session.worktreeStateId !== snapshotResult.worktreeStateId
      ) {
        throw new Error(input.staleSessionMessage);
      }

      const context = {
        rootPath: snapshot.rootPath,
        projectId: config.project.projectId,
        repoId: config.project.repoId,
        snapshotId: snapshotResult.snapshotId,
        worktreeStateId: snapshotResult.worktreeStateId,
        branch: snapshotResult.snapshot.branch,
        commit: snapshotResult.snapshot.commit,
        worktreeHash: snapshotResult.snapshot.worktreeHash
      };

      return {
        context,
        value: operation({ database, context })
      };
    }
  }).value;
}
