import type { DatabaseSync } from "node:sqlite";

import type {
  ContextSessionRecord,
  SessionEventRecord,
  StorageRepositories
} from "../repositories.js";

export function createSessionStorageRepositories(
  database: DatabaseSync
): Pick<StorageRepositories, "contextSessions" | "sessionEvents"> {
  return {
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
      },
      list() {
        return (
          database
            .prepare("SELECT * FROM context_sessions ORDER BY updated_at DESC, session_id ASC")
            .all() as Array<Record<string, unknown>>
        ).map(mapContextSessionRequired);
      },
      acquireLock(update) {
        const result = database
          .prepare(
            [
              "UPDATE context_sessions",
              "SET lock_token = ?, lock_status = 'locked', last_seen_at = ?, updated_at = ?",
              "WHERE session_id = ? AND lock_status IN ('unlocked', 'expired')"
            ].join(" ")
          )
          .run(update.lockToken, update.now, update.now, update.sessionId);
        return result.changes === 1;
      },
      renewLock(update) {
        const result = database
          .prepare(
            [
              "UPDATE context_sessions",
              "SET last_seen_at = ?, updated_at = ?",
              "WHERE session_id = ? AND lock_token = ? AND lock_status = 'locked'"
            ].join(" ")
          )
          .run(update.now, update.now, update.sessionId, update.lockToken);
        return result.changes === 1;
      },
      releaseLock(update) {
        const result = database
          .prepare(
            [
              "UPDATE context_sessions",
              "SET lock_token = NULL, lock_status = 'unlocked', last_seen_at = ?, updated_at = ?",
              "WHERE session_id = ? AND lock_token = ? AND lock_status = 'locked'"
            ].join(" ")
          )
          .run(update.now, update.now, update.sessionId, update.lockToken);
        return result.changes === 1;
      },
      expireLock(update) {
        const params = update.expectedLockToken
          ? [update.now, update.now, update.sessionId, update.expectedLockToken]
          : [update.now, update.now, update.sessionId];
        const result = database
          .prepare(
            [
              "UPDATE context_sessions",
              "SET lock_status = 'expired', last_seen_at = ?, updated_at = ?",
              update.expectedLockToken
                ? "WHERE session_id = ? AND lock_token = ? AND lock_status = 'locked'"
                : "WHERE session_id = ? AND lock_status = 'locked'"
            ].join(" ")
          )
          .run(...params);
        return result.changes === 1;
      },
      updateCompileState(update) {
        const result = database
          .prepare(
            [
              "UPDATE context_sessions",
              [
                "SET repo_snapshot_id = ?, worktree_state_id = ?, branch_name = ?,",
                "base_commit_sha = ?, head_commit_sha = ?, status = ?, last_seen_at = ?, updated_at = ?"
              ].join(" "),
              "WHERE session_id = ?"
            ].join(" ")
          )
          .run(
            update.repoSnapshotId,
            update.worktreeStateId,
            update.branchName,
            sqlNullable(update.baseCommitSha),
            update.headCommitSha,
            update.status,
            update.now,
            update.now,
            update.sessionId
          );
        return result.changes === 1;
      }
    },
    sessionEvents: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO session_events",
              "(event_id, session_id, event_type, reason, metadata_json, created_at)",
              "VALUES (?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.eventId,
            record.sessionId,
            record.eventType,
            record.reason,
            record.metadataJson,
            record.createdAt
          );
      },
      listBySession(sessionId) {
        return (
          database
            .prepare("SELECT * FROM session_events WHERE session_id = ? ORDER BY created_at ASC, event_id ASC")
            .all(sessionId) as Array<Record<string, unknown>>
        ).map(mapSessionEvent);
      }
    }
  };
}

function mapContextSession(row: Record<string, unknown> | undefined): ContextSessionRecord | undefined {
  if (!row) return undefined;
  return mapContextSessionRequired(row);
}

function mapContextSessionRequired(row: Record<string, unknown>): ContextSessionRecord {
  return {
    sessionId: stringField(row, "session_id"),
    projectId: stringField(row, "project_id"),
    repoId: stringField(row, "repo_id"),
    repoSnapshotId: stringField(row, "repo_snapshot_id"),
    worktreeStateId: stringField(row, "worktree_state_id"),
    agentName: optionalStringField(row, "agent_name"),
    agentSessionId: optionalStringField(row, "agent_session_id"),
    taskId: optionalStringField(row, "task_id"),
    taskType: optionalStringField(row, "task_type") as ContextSessionRecord["taskType"],
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

function mapSessionEvent(row: Record<string, unknown>): SessionEventRecord {
  return {
    eventId: stringField(row, "event_id"),
    sessionId: stringField(row, "session_id"),
    eventType: stringField(row, "event_type"),
    reason: stringField(row, "reason"),
    metadataJson: stringField(row, "metadata_json"),
    createdAt: stringField(row, "created_at")
  };
}

function stringField(row: Record<string, unknown>, key: string): string {
  return String(row[key]);
}

function optionalStringField(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  return value === null || value === undefined ? undefined : String(value);
}

function sqlNullable(value: string | undefined): string | null {
  return value ?? null;
}
