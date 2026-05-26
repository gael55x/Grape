import type { DatabaseSync } from "node:sqlite";

import type {
  PrivacyStatus,
  SourceRedactionStatus,
  SourceScope,
  SourceTrustClass,
  SourceType
} from "../../shared/index.js";
import { applySqliteConnectionPolicy } from "./sqlite-policy.js";

export interface SourceRecord {
  readonly sourceId: string;
  readonly snapshotId?: string;
  readonly sourceType: SourceType;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: SourceScope;
  readonly trustClass: SourceTrustClass;
  readonly privacyStatus: PrivacyStatus;
  readonly redactionStatus: SourceRedactionStatus;
  readonly metadataJson: string;
  readonly createdAt: string;
}

export interface SourceRejectionRecord {
  readonly rejectionId: string;
  readonly sourceRef: string;
  readonly rejectionReason: string;
  readonly privacyStatus: PrivacyStatus;
  readonly metadataJson: string;
  readonly createdAt: string;
}

export interface EvidenceStorageRepositories {
  readonly sources: {
    insertOrIgnore(record: SourceRecord): boolean;
    get(sourceId: string): SourceRecord | undefined;
    listBySnapshot(snapshotId: string): readonly SourceRecord[];
  };
  readonly sourceRejections: {
    insertOrIgnore(record: SourceRejectionRecord): boolean;
    get(rejectionId: string): SourceRejectionRecord | undefined;
    listAll(): readonly SourceRejectionRecord[];
  };
}

export function createEvidenceStorageRepositories(database: DatabaseSync): EvidenceStorageRepositories {
  applySqliteConnectionPolicy(database);

  return {
    sources: {
      insertOrIgnore(record) {
        const result = database
          .prepare(
            [
              "INSERT OR IGNORE INTO sources",
              [
                "(source_id, snapshot_id, source_type, source_ref, source_hash, source_scope,",
                "trust_class, privacy_status, redaction_status, metadata_json, created_at)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.sourceId,
            record.snapshotId ?? null,
            record.sourceType,
            record.sourceRef,
            record.sourceHash,
            record.sourceScope,
            record.trustClass,
            record.privacyStatus,
            record.redactionStatus,
            record.metadataJson,
            record.createdAt
          );
        return result.changes === 1;
      },
      get(sourceId) {
        return mapSource(
          database
            .prepare("SELECT * FROM sources WHERE source_id = ?")
            .get(sourceId) as Record<string, unknown> | undefined
        );
      },
      listBySnapshot(snapshotId) {
        return (
          database
            .prepare("SELECT * FROM sources WHERE snapshot_id = ? ORDER BY source_ref ASC, source_id ASC")
            .all(snapshotId) as Array<Record<string, unknown>>
        ).map(mapRequiredSource);
      }
    },
    sourceRejections: {
      insertOrIgnore(record) {
        const result = database
          .prepare(
            [
              "INSERT OR IGNORE INTO source_rejections",
              "(rejection_id, source_ref, rejection_reason, privacy_status, metadata_json, created_at)",
              "VALUES (?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.rejectionId,
            record.sourceRef,
            record.rejectionReason,
            record.privacyStatus,
            record.metadataJson,
            record.createdAt
          );
        return result.changes === 1;
      },
      get(rejectionId) {
        return mapSourceRejection(
          database
            .prepare("SELECT * FROM source_rejections WHERE rejection_id = ?")
            .get(rejectionId) as Record<string, unknown> | undefined
        );
      },
      listAll() {
        return (
          database
            .prepare("SELECT * FROM source_rejections ORDER BY source_ref ASC, rejection_id ASC")
            .all() as Array<Record<string, unknown>>
        ).map(mapRequiredSourceRejection);
      }
    }
  };
}

function mapSource(row: Record<string, unknown> | undefined): SourceRecord | undefined {
  if (!row) return undefined;
  return mapRequiredSource(row);
}

function mapRequiredSource(row: Record<string, unknown>): SourceRecord {
  return {
    sourceId: stringField(row, "source_id"),
    snapshotId: optionalStringField(row, "snapshot_id"),
    sourceType: stringField(row, "source_type") as SourceType,
    sourceRef: stringField(row, "source_ref"),
    sourceHash: stringField(row, "source_hash"),
    sourceScope: stringField(row, "source_scope") as SourceScope,
    trustClass: stringField(row, "trust_class") as SourceTrustClass,
    privacyStatus: stringField(row, "privacy_status") as PrivacyStatus,
    redactionStatus: stringField(row, "redaction_status") as SourceRedactionStatus,
    metadataJson: stringField(row, "metadata_json"),
    createdAt: stringField(row, "created_at")
  };
}

function mapSourceRejection(row: Record<string, unknown> | undefined): SourceRejectionRecord | undefined {
  if (!row) return undefined;
  return mapRequiredSourceRejection(row);
}

function mapRequiredSourceRejection(row: Record<string, unknown>): SourceRejectionRecord {
  return {
    rejectionId: stringField(row, "rejection_id"),
    sourceRef: stringField(row, "source_ref"),
    rejectionReason: stringField(row, "rejection_reason"),
    privacyStatus: stringField(row, "privacy_status") as PrivacyStatus,
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
