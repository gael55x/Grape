import type { DatabaseSync } from "node:sqlite";

import type { SourceType } from "../../shared/index.js";

export interface FtsEntryRecord {
  readonly ftsEntryId: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly sourceId: string;
  readonly sourceRef: string;
  readonly sourceType: SourceType;
  readonly sourceHash: string;
  readonly textHash: string;
  readonly metadataJson: string;
  readonly createdAt: string;
}

export interface FtsEntryInsertRecord extends FtsEntryRecord {
  readonly body: string;
}

export interface FtsEntriesRepository {
  insertOrIgnore(record: FtsEntryInsertRecord): boolean;
  get(ftsEntryId: string): FtsEntryRecord | undefined;
  listBySnapshot(snapshotId: string): readonly FtsEntryRecord[];
  searchSnapshot(snapshotId: string, query: string, limit?: number): readonly FtsEntryRecord[];
}

export function createFtsEntriesRepository(database: DatabaseSync): FtsEntriesRepository {
  return {
    insertOrIgnore(record) {
      const result = database
        .prepare(
          [
            "INSERT OR IGNORE INTO fts_entries",
            [
              "(fts_entry_id, project_id, repo_id, snapshot_id, source_id, source_ref, source_type,",
              "source_hash, text_hash, metadata_json, created_at)"
            ].join(" "),
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ].join(" ")
        )
        .run(
          record.ftsEntryId,
          record.projectId,
          record.repoId,
          record.snapshotId,
          record.sourceId,
          record.sourceRef,
          record.sourceType,
          record.sourceHash,
          record.textHash,
          record.metadataJson,
          record.createdAt
        );

      if (result.changes !== 1) return false;

      database
        .prepare(
          "INSERT INTO fts_entry_text (fts_entry_id, source_id, source_ref, body) VALUES (?, ?, ?, ?)"
        )
        .run(record.ftsEntryId, record.sourceId, record.sourceRef, record.body);
      return true;
    },
    get(ftsEntryId) {
      return mapFtsEntry(
        database
          .prepare("SELECT * FROM fts_entries WHERE fts_entry_id = ?")
          .get(ftsEntryId) as Record<string, unknown> | undefined
      );
    },
    listBySnapshot(snapshotId) {
      return (
        database
          .prepare("SELECT * FROM fts_entries WHERE snapshot_id = ? ORDER BY source_ref ASC, fts_entry_id ASC")
          .all(snapshotId) as Array<Record<string, unknown>>
      ).map(mapRequiredFtsEntry);
    },
    searchSnapshot(snapshotId, query, limit = 20) {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return [];

      return (
        database
          .prepare(
            [
              "SELECT e.*, t.body FROM fts_entries e",
              "JOIN fts_entry_text t ON t.fts_entry_id = e.fts_entry_id",
              "WHERE e.snapshot_id = ?",
              "ORDER BY e.source_ref ASC, e.fts_entry_id ASC"
            ].join(" ")
          )
          .all(snapshotId) as Array<Record<string, unknown>>
      )
        .filter((row) => bodyMatchesQuery(stringField(row, "body"), trimmedQuery))
        .slice(0, limit)
        .map(mapRequiredFtsEntry);
    }
  };
}

function bodyMatchesQuery(body: string, query: string): boolean {
  const normalizedBody = normalizeSearchText(body);
  const normalizedQuery = normalizeSearchText(query);
  return normalizedQuery.length > 0 && normalizedBody.includes(normalizedQuery);
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function mapFtsEntry(row: Record<string, unknown> | undefined): FtsEntryRecord | undefined {
  if (!row) return undefined;
  return mapRequiredFtsEntry(row);
}

function mapRequiredFtsEntry(row: Record<string, unknown>): FtsEntryRecord {
  return {
    ftsEntryId: stringField(row, "fts_entry_id"),
    projectId: stringField(row, "project_id"),
    repoId: stringField(row, "repo_id"),
    snapshotId: stringField(row, "snapshot_id"),
    sourceId: stringField(row, "source_id"),
    sourceRef: stringField(row, "source_ref"),
    sourceType: stringField(row, "source_type") as SourceType,
    sourceHash: stringField(row, "source_hash"),
    textHash: stringField(row, "text_hash"),
    metadataJson: stringField(row, "metadata_json"),
    createdAt: stringField(row, "created_at")
  };
}

function stringField(row: Record<string, unknown>, key: string): string {
  return String(row[key]);
}
