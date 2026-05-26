import path from "node:path";

import { createGitRepoSnapshot } from "../../core/git/index.js";
import { createStorageRepositories } from "../../core/storage/index.js";
import type { ContextSessionRecord } from "../../core/storage/index.js";
import { ensureLocalProjectLayout, readLocalProjectConfig } from "./config.js";
import { withMigratedLocalDatabase } from "./storage.js";
import type { ListLocalSessionsInput, ListLocalSessionsResult, LocalSessionSummary } from "./types.js";

export function listLocalSessions(input: ListLocalSessionsInput): ListLocalSessionsResult {
  const rootPath = path.resolve(input.rootPath);
  const snapshot = createGitRepoSnapshot({ rootPath, createdAt: new Date().toISOString() });
  const layout = ensureLocalProjectLayout(snapshot.rootPath);
  const config = readLocalProjectConfig(layout.configPath);
  if (!config) throw new Error("Grape config is missing. Run grape init --connect.");
  if (path.resolve(config.project.rootPath) !== snapshot.rootPath) {
    throw new Error("Grape config root path does not match the current repository path.");
  }

  return withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => new Date().toISOString(),
    operation(database): ListLocalSessionsResult {
      const repositories = createStorageRepositories(database);
      return {
        rootPath: snapshot.rootPath,
        sessions: repositories.contextSessions.list().map((session) =>
          toLocalSessionSummary({ repositories, session })
        )
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
    omittedItemCount: input.repositories.omittedContextItems.listBySession(session.sessionId).length,
    packItemCount: input.repositories.contextPackItems.listBySession(session.sessionId).length,
    eventCount: events.length,
    lastEventReason: events.at(-1)?.reason
  };
}
