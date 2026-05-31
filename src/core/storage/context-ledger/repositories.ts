import type { DatabaseSync } from "node:sqlite";

import type {
  ContextPackItemKind,
  ContextPackItemRecord,
  ContextSentItemRecord,
  OmittedContextItemRecord,
  OmittedContextReason,
  StorageRepositories
} from "../repositories.js";

export function createContextLedgerStorageRepositories(
  database: DatabaseSync
): Pick<StorageRepositories, "contextSentItems" | "omittedContextItems" | "contextPackItems"> {
  return {
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
                "content_hash, branch_name, commit_sha, dependency_manifest_hash, last_diff_state,",
                "reason_omitted, can_restore, restore_id, restore_command, omitted_at, send_count, token_count)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
            record.branchName,
            record.commitSha,
            record.dependencyManifestHash,
            record.lastDiffState,
            record.reasonOmitted,
            boolToInt(record.canRestore),
            sqlNullable(record.restoreId),
            sqlNullable(record.restoreCommand),
            record.omittedAt,
            record.sendCount,
            record.tokenCount
          );
      },
      listBySession(sessionId) {
        return (
          database
            .prepare("SELECT * FROM omitted_context_items WHERE session_id = ? ORDER BY omitted_item_id ASC")
            .all(sessionId) as Array<Record<string, unknown>>
        ).map(mapOmittedContextItem);
      },
      getBySessionAndRestoreId(sessionId, restoreId) {
        return mapOmittedContextItemOptional(
          database
            .prepare(
              [
                "SELECT * FROM omitted_context_items",
                "WHERE session_id = ? AND restore_id = ?",
                "ORDER BY omitted_at DESC, omitted_item_id DESC",
                "LIMIT 1"
              ].join(" ")
            )
            .get(sessionId, restoreId) as Record<string, unknown> | undefined
        );
      }
    },
    contextPackItems: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO context_pack_items",
              [
                "(pack_item_id, session_id, artifact_id, section_id, diff_state, item_kind, item_ref,",
                "content_hash, token_count, pinned, safety_critical, invalidates_sent_item_id, restore_id,",
                "input_refs_json, created_at)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.packItemId,
            record.sessionId,
            record.artifactId,
            sqlNullable(record.sectionId),
            record.diffState,
            record.itemKind,
            record.itemRef,
            record.contentHash,
            record.tokenCount,
            boolToInt(record.pinned),
            boolToInt(record.safetyCritical),
            sqlNullable(record.invalidatesSentItemId),
            sqlNullable(record.restoreId),
            record.inputRefsJson,
            record.createdAt
          );
      },
      listBySession(sessionId) {
        return (
          database
            .prepare("SELECT * FROM context_pack_items WHERE session_id = ? ORDER BY created_at ASC, pack_item_id ASC")
            .all(sessionId) as Array<Record<string, unknown>>
        ).map(mapContextPackItem);
      }
    }
  };
}

function mapContextSentItem(row: Record<string, unknown>): ContextSentItemRecord {
  return {
    sentItemId: stringField(row, "sent_item_id"),
    sessionId: stringField(row, "session_id"),
    artifactId: stringField(row, "artifact_id"),
    sectionId: stringField(row, "section_id"),
    taskId: optionalStringField(row, "task_id"),
    itemKind: stringField(row, "item_kind") as ContextPackItemKind,
    itemRef: stringField(row, "item_ref"),
    itemHash: stringField(row, "item_hash"),
    contentHash: stringField(row, "content_hash"),
    branchName: stringField(row, "branch_name"),
    commitSha: stringField(row, "commit_sha"),
    dependencyManifestHash: stringField(row, "dependency_manifest_hash"),
    wasPinned: intToBool(row.was_pinned),
    lastDiffState: stringField(row, "last_diff_state") as ContextSentItemRecord["lastDiffState"],
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
    itemKind: stringField(row, "item_kind") as ContextPackItemKind,
    itemRef: stringField(row, "item_ref"),
    itemHash: stringField(row, "item_hash"),
    contentHash: stringField(row, "content_hash"),
    branchName: stringField(row, "branch_name"),
    commitSha: stringField(row, "commit_sha"),
    dependencyManifestHash: stringField(row, "dependency_manifest_hash"),
    lastDiffState: stringField(row, "last_diff_state") as OmittedContextItemRecord["lastDiffState"],
    reasonOmitted: stringField(row, "reason_omitted") as OmittedContextReason,
    canRestore: intToBool(row.can_restore),
    restoreId: optionalStringField(row, "restore_id"),
    restoreCommand: optionalStringField(row, "restore_command"),
    omittedAt: stringField(row, "omitted_at"),
    sendCount: numberField(row, "send_count"),
    tokenCount: numberField(row, "token_count")
  };
}

function mapOmittedContextItemOptional(
  row: Record<string, unknown> | undefined
): OmittedContextItemRecord | undefined {
  return row ? mapOmittedContextItem(row) : undefined;
}

function mapContextPackItem(row: Record<string, unknown>): ContextPackItemRecord {
  return {
    packItemId: stringField(row, "pack_item_id"),
    sessionId: stringField(row, "session_id"),
    artifactId: stringField(row, "artifact_id"),
    sectionId: optionalStringField(row, "section_id"),
    diffState: stringField(row, "diff_state") as ContextPackItemRecord["diffState"],
    itemKind: stringField(row, "item_kind") as ContextPackItemKind,
    itemRef: stringField(row, "item_ref"),
    contentHash: stringField(row, "content_hash"),
    tokenCount: numberField(row, "token_count"),
    pinned: intToBool(row.pinned),
    safetyCritical: intToBool(row.safety_critical),
    invalidatesSentItemId: optionalStringField(row, "invalidates_sent_item_id"),
    restoreId: optionalStringField(row, "restore_id"),
    inputRefsJson: stringField(row, "input_refs_json"),
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
