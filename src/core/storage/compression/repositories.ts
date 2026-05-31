import type { DatabaseSync } from "node:sqlite";

import type { CompressionArtifactType, CompressionMethod } from "../../../shared/index.js";
import { applySqliteConnectionPolicy } from "../sqlite-policy.js";

export type StoredCompressionArtifactType = Extract<
  CompressionArtifactType,
  "symbol_outline" | "rule_digest" | "context_pack_summary"
>;

export type CompressionInputKind =
  | "claim"
  | "proof"
  | "file"
  | "rule"
  | "test"
  | "symbol"
  | "context_artifact"
  | "config"
  | "lockfile";

export type CompressionTrustStatus = "derived_cache" | "stale" | "invalid";

export interface CompressionArtifactRecord {
  readonly compressionId: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly repoSnapshotId: string;
  readonly worktreeStateId?: string;
  readonly artifactType: StoredCompressionArtifactType;
  readonly method: CompressionMethod;
  readonly summaryText: string;
  readonly inputHash: string;
  readonly policyHash: string;
  readonly scopeHash: string;
  readonly outputHash: string;
  readonly trustStatus: CompressionTrustStatus;
  readonly invalidatedAt?: string;
  readonly invalidationReason?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CompressionInputRecord {
  readonly compressionInputId: string;
  readonly compressionId: string;
  readonly inputKind: CompressionInputKind;
  readonly inputRef: string;
  readonly inputHash: string;
}

export interface CompressionStorageRepositories {
  readonly compressionArtifacts: {
    upsert(record: CompressionArtifactRecord): void;
    get(compressionId: string): CompressionArtifactRecord | undefined;
    listBySnapshot(snapshotId: string): readonly CompressionArtifactRecord[];
  };
  readonly compressionInputs: {
    upsert(record: CompressionInputRecord): void;
    listByArtifact(compressionId: string): readonly CompressionInputRecord[];
  };
}

export function createCompressionStorageRepositories(database: DatabaseSync): CompressionStorageRepositories {
  applySqliteConnectionPolicy(database);

  return {
    compressionArtifacts: {
      upsert(record) {
        database
          .prepare(
            [
              "INSERT INTO compression_artifacts",
              [
                "(compression_id, project_id, repo_id, repo_snapshot_id, worktree_state_id, artifact_type,",
                "method, summary_text, input_hash, policy_hash, scope_hash, output_hash, trust_status,",
                "invalidated_at, invalidation_reason, created_at, updated_at)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              "ON CONFLICT(compression_id) DO UPDATE SET",
              [
                "summary_text = excluded.summary_text",
                "input_hash = excluded.input_hash",
                "policy_hash = excluded.policy_hash",
                "scope_hash = excluded.scope_hash",
                "output_hash = excluded.output_hash",
                "trust_status = excluded.trust_status",
                "invalidated_at = excluded.invalidated_at",
                "invalidation_reason = excluded.invalidation_reason",
                "updated_at = excluded.updated_at"
              ].join(", ")
            ].join(" ")
          )
          .run(
            record.compressionId,
            record.projectId,
            record.repoId,
            record.repoSnapshotId,
            sqlNullable(record.worktreeStateId),
            record.artifactType,
            record.method,
            record.summaryText,
            record.inputHash,
            record.policyHash,
            record.scopeHash,
            record.outputHash,
            record.trustStatus,
            sqlNullable(record.invalidatedAt),
            sqlNullable(record.invalidationReason),
            record.createdAt,
            record.updatedAt
          );
      },
      get(compressionId) {
        return mapCompressionArtifact(
          database
            .prepare("SELECT * FROM compression_artifacts WHERE compression_id = ?")
            .get(compressionId) as Record<string, unknown> | undefined
        );
      },
      listBySnapshot(snapshotId) {
        return (
          database
            .prepare(
              [
                "SELECT * FROM compression_artifacts",
                "WHERE repo_snapshot_id = ?",
                "ORDER BY artifact_type ASC, compression_id ASC"
              ].join(" ")
            )
            .all(snapshotId) as Array<Record<string, unknown>>
        ).map(mapCompressionArtifactRequired);
      }
    },
    compressionInputs: {
      upsert(record) {
        database
          .prepare(
            [
              "INSERT INTO compression_inputs",
              "(compression_input_id, compression_id, input_kind, input_ref, input_hash)",
              "VALUES (?, ?, ?, ?, ?)",
              "ON CONFLICT(compression_input_id) DO UPDATE SET",
              "input_hash = excluded.input_hash"
            ].join(" ")
          )
          .run(
            record.compressionInputId,
            record.compressionId,
            record.inputKind,
            record.inputRef,
            record.inputHash
          );
      },
      listByArtifact(compressionId) {
        return (
          database
            .prepare("SELECT * FROM compression_inputs WHERE compression_id = ? ORDER BY compression_input_id ASC")
            .all(compressionId) as Array<Record<string, unknown>>
        ).map(mapCompressionInput);
      }
    }
  };
}

function mapCompressionArtifact(row: Record<string, unknown> | undefined): CompressionArtifactRecord | undefined {
  if (!row) return undefined;
  return mapCompressionArtifactRequired(row);
}

function mapCompressionArtifactRequired(row: Record<string, unknown>): CompressionArtifactRecord {
  return {
    compressionId: stringColumn(row, "compression_id"),
    projectId: stringColumn(row, "project_id"),
    repoId: stringColumn(row, "repo_id"),
    repoSnapshotId: stringColumn(row, "repo_snapshot_id"),
    worktreeStateId: optionalStringColumn(row, "worktree_state_id"),
    artifactType: stringColumn(row, "artifact_type") as StoredCompressionArtifactType,
    method: stringColumn(row, "method") as CompressionMethod,
    summaryText: stringColumn(row, "summary_text"),
    inputHash: stringColumn(row, "input_hash"),
    policyHash: stringColumn(row, "policy_hash"),
    scopeHash: stringColumn(row, "scope_hash"),
    outputHash: stringColumn(row, "output_hash"),
    trustStatus: stringColumn(row, "trust_status") as CompressionTrustStatus,
    invalidatedAt: optionalStringColumn(row, "invalidated_at"),
    invalidationReason: optionalStringColumn(row, "invalidation_reason"),
    createdAt: stringColumn(row, "created_at"),
    updatedAt: stringColumn(row, "updated_at")
  };
}

function mapCompressionInput(row: Record<string, unknown>): CompressionInputRecord {
  return {
    compressionInputId: stringColumn(row, "compression_input_id"),
    compressionId: stringColumn(row, "compression_id"),
    inputKind: stringColumn(row, "input_kind") as CompressionInputKind,
    inputRef: stringColumn(row, "input_ref"),
    inputHash: stringColumn(row, "input_hash")
  };
}

function stringColumn(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`expected string column: ${key}`);
  return value;
}

function optionalStringColumn(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`expected optional string column: ${key}`);
  return value;
}

function sqlNullable(value: string | undefined): string | null {
  return value ?? null;
}
