import path from "node:path";

import { createGitRepoSnapshot } from "../../core/git/index.js";
import { createStorageRepositories } from "../../core/storage/index.js";
import type {
  ContextPackItemRecord,
  ContextSentItemRecord,
  ContextSessionRecord,
  SessionEventRecord
} from "../../core/storage/index.js";
import { ensureLocalProjectLayout, readLocalProjectConfig } from "./config.js";
import { withMigratedLocalDatabase } from "./storage.js";

export interface LocalStaleItemSummary {
  readonly staleItemId: string;
  readonly sessionId: string;
  readonly artifactId: string;
  readonly sectionId?: string;
  readonly itemKind: string;
  readonly itemRef: string;
  readonly invalidatesSentItemId: string;
  readonly staleReason: "branch_changed" | "session_reset" | "dependency_manifest_changed";
  readonly previousArtifactId?: string;
  readonly previousSectionId?: string;
  readonly previousBranchName?: string;
  readonly previousCommitSha?: string;
  readonly dependencyRefs: readonly string[];
  readonly createdAt: string;
}

export interface ListLocalStaleItemsInput {
  readonly rootPath: string;
  readonly sessionId?: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface ListLocalStaleItemsResult {
  readonly rootPath: string;
  readonly sessionId?: string;
  readonly inspectedSessionCount: number;
  readonly staleItems: readonly LocalStaleItemSummary[];
}

export function listLocalStaleItems(input: ListLocalStaleItemsInput): ListLocalStaleItemsResult {
  const rootPath = path.resolve(input.rootPath);
  const snapshot = createGitRepoSnapshot({
    rootPath,
    createdAt: input.now ?? new Date().toISOString(),
    gitBinary: input.gitBinary
  });
  const layout = ensureLocalProjectLayout(snapshot.rootPath);
  const config = readLocalProjectConfig(layout.configPath);
  if (!config) throw new Error("Grape config is missing. Run grape init --connect.");
  if (path.resolve(config.project.rootPath) !== snapshot.rootPath) {
    throw new Error("Grape config root path does not match the current repository path.");
  }

  return withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => input.now ?? new Date().toISOString(),
    operation(database): ListLocalStaleItemsResult {
      const repositories = createStorageRepositories(database);
      const sessions = selectSessions(repositories.contextSessions.list(), input.sessionId);
      const staleItems = sessions
        .flatMap((session) => staleItemsForSession(repositories, session))
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) || left.staleItemId.localeCompare(right.staleItemId)
        );
      return {
        rootPath: snapshot.rootPath,
        sessionId: input.sessionId,
        inspectedSessionCount: sessions.length,
        staleItems
      };
    }
  }).value;
}

function selectSessions(
  sessions: readonly ContextSessionRecord[],
  sessionId: string | undefined
): readonly ContextSessionRecord[] {
  if (!sessionId) return sessions;
  return sessions.filter((session) => session.sessionId === sessionId);
}

function staleItemsForSession(
  repositories: ReturnType<typeof createStorageRepositories>,
  session: ContextSessionRecord
): LocalStaleItemSummary[] {
  const events = repositories.sessionEvents.listBySession(session.sessionId);
  const sentItemsById = new Map(
    repositories.contextSentItems.listBySession(session.sessionId).map((item) => [item.sentItemId, item])
  );

  return repositories.contextPackItems
    .listBySession(session.sessionId)
    .filter(isInvalidationItem)
    .map((item) => toStaleItemSummary(item, sentItemsById.get(item.invalidatesSentItemId), events));
}

function isInvalidationItem(item: ContextPackItemRecord): item is ContextPackItemRecord & {
  readonly invalidatesSentItemId: string;
} {
  return item.diffState === "INVALIDATE_PREVIOUS" && Boolean(item.invalidatesSentItemId);
}

function toStaleItemSummary(
  item: ContextPackItemRecord & { readonly invalidatesSentItemId: string },
  previous: ContextSentItemRecord | undefined,
  events: readonly SessionEventRecord[]
): LocalStaleItemSummary {
  return {
    staleItemId: item.packItemId,
    sessionId: item.sessionId,
    artifactId: item.artifactId,
    sectionId: item.sectionId,
    itemKind: item.itemKind,
    itemRef: item.itemRef,
    invalidatesSentItemId: item.invalidatesSentItemId,
    staleReason: staleReasonForArtifact(events, item.artifactId),
    previousArtifactId: previous?.artifactId,
    previousSectionId: previous?.sectionId,
    previousBranchName: previous?.branchName,
    previousCommitSha: previous?.commitSha,
    dependencyRefs: parseDependencyRefs(item.inputRefsJson),
    createdAt: item.createdAt
  };
}

function staleReasonForArtifact(
  events: readonly SessionEventRecord[],
  artifactId: string
): LocalStaleItemSummary["staleReason"] {
  const artifactReasons = events
    .filter((event) => event.eventId.startsWith(`${artifactId}:`))
    .map((event) => event.reason);
  if (artifactReasons.includes("branch_changed")) return "branch_changed";
  if (artifactReasons.includes("session_reset")) return "session_reset";
  return "dependency_manifest_changed";
}

function parseDependencyRefs(inputRefsJson: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(inputRefsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}
