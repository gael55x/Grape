import path from "node:path";

import { createGitRepoSnapshot } from "../../../core/git/index.js";
import { createStorageRepositories } from "../../../core/storage/index.js";
import type { ContextSessionRecord } from "../../../core/storage/index.js";
import { ensureConfiguredLocalProjectLayout } from "../setup/configured-layout.js";
import { withMigratedLocalDatabase } from "../setup/storage.js";
import type { ListLocalSessionsInput, ListLocalSessionsResult, LocalSessionSummary } from "../types.js";

export function listLocalSessions(input: ListLocalSessionsInput): ListLocalSessionsResult {
  const rootPath = path.resolve(input.rootPath);
  const snapshot = createGitRepoSnapshot({ rootPath, createdAt: new Date().toISOString() });
  const { layout } = ensureConfiguredLocalProjectLayout(snapshot.rootPath);

  return withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => new Date().toISOString(),
    operation(database): ListLocalSessionsResult {
      const repositories = createStorageRepositories(database);
      const sessions = repositories.contextSessions.list().map((session) =>
        toLocalSessionSummary({ repositories, session })
      );
      return {
        rootPath: snapshot.rootPath,
        continuity: continuitySummary(sessions),
        sessions
      };
    }
  }).value;
}

function toLocalSessionSummary(input: {
  readonly repositories: ReturnType<typeof createStorageRepositories>;
  readonly session: ContextSessionRecord;
}): LocalSessionSummary {
  const session = input.session;
  const events = input.repositories.sessionEvents.listBySession(session.sessionId);
  const omittedItems = input.repositories.omittedContextItems.listBySession(session.sessionId);
  const invalidatedSentItemIds = input.repositories.contextPackItems.listInvalidatedSentItemIdsBySession(
    session.sessionId
  );
  return {
    sessionId: session.sessionId,
    status: session.status,
    lockStatus: session.lockStatus,
    taskId: session.taskId,
    taskType: session.taskType,
    branchName: session.branchName,
    headCommitSha: session.headCommitSha,
    startedAt: session.startedAt,
    lastSeenAt: session.lastSeenAt,
    updatedAt: session.updatedAt,
    artifactCount: input.repositories.contextArtifacts.listBySession(session.sessionId).length,
    sentItemCount: input.repositories.contextSentItems.listBySession(session.sessionId).length,
    activeSentItemCount: input.repositories.contextSentItems.listActiveBySession(session.sessionId).length,
    omittedItemCount: omittedItems.length,
    restorableOmittedItemCount: omittedItems.filter((item) => item.canRestore && item.restoreId).length,
    omittedTokenCount: omittedItems.reduce((total, item) => total + item.tokenCount, 0),
    invalidatedSentItemCount: invalidatedSentItemIds.length,
    packItemCount: input.repositories.contextPackItems.listBySession(session.sessionId).length,
    eventCount: events.length,
    lastEventReason: events.at(-1)?.reason
  };
}

function continuitySummary(sessions: readonly LocalSessionSummary[]): ListLocalSessionsResult["continuity"] {
  return {
    sessionCount: sessions.length,
    sentItemCount: sessions.reduce((total, session) => total + session.sentItemCount, 0),
    activeSentItemCount: sessions.reduce((total, session) => total + session.activeSentItemCount, 0),
    omittedItemCount: sessions.reduce((total, session) => total + session.omittedItemCount, 0),
    restorableOmittedItemCount: sessions.reduce((total, session) => total + session.restorableOmittedItemCount, 0),
    omittedTokenCount: sessions.reduce((total, session) => total + session.omittedTokenCount, 0),
    invalidatedSentItemCount: sessions.reduce((total, session) => total + session.invalidatedSentItemCount, 0),
    packItemCount: sessions.reduce((total, session) => total + session.packItemCount, 0)
  };
}
