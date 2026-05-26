import type { DatabaseSync } from "node:sqlite";

import { applySqliteConnectionPolicy } from "./sqlite-policy.js";

export type ProofSupportStatus = "direct" | "indirect" | "partial" | "context_only" | "contradicts";

export interface ProofRecord {
  readonly proofId: string;
  readonly claimId?: string;
  readonly sourceId: string;
  readonly proofType: string;
  readonly sourceHash: string;
  readonly excerptHash: string;
  readonly supportStatus: ProofSupportStatus;
  readonly createdAt: string;
}

export interface ProofStorageRepositories {
  readonly proofs: {
    insertOrIgnore(record: ProofRecord): boolean;
    get(proofId: string): ProofRecord | undefined;
    listBySource(sourceId: string): readonly ProofRecord[];
  };
}

export function createProofStorageRepositories(database: DatabaseSync): ProofStorageRepositories {
  applySqliteConnectionPolicy(database);

  return {
    proofs: {
      insertOrIgnore(record) {
        const result = database
          .prepare(
            [
              "INSERT OR IGNORE INTO proofs",
              [
                "(proof_id, claim_id, source_id, proof_type, source_hash, excerpt_hash,",
                "support_status, created_at)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.proofId,
            record.claimId ?? null,
            record.sourceId,
            record.proofType,
            record.sourceHash,
            record.excerptHash,
            record.supportStatus,
            record.createdAt
          );
        return result.changes === 1;
      },
      get(proofId) {
        return mapProof(
          database
            .prepare("SELECT * FROM proofs WHERE proof_id = ?")
            .get(proofId) as Record<string, unknown> | undefined
        );
      },
      listBySource(sourceId) {
        return (
          database
            .prepare("SELECT * FROM proofs WHERE source_id = ? ORDER BY proof_id ASC")
            .all(sourceId) as Array<Record<string, unknown>>
        ).map(mapRequiredProof);
      }
    }
  };
}

function mapProof(row: Record<string, unknown> | undefined): ProofRecord | undefined {
  if (!row) return undefined;
  return mapRequiredProof(row);
}

function mapRequiredProof(row: Record<string, unknown>): ProofRecord {
  return {
    proofId: stringField(row, "proof_id"),
    claimId: optionalStringField(row, "claim_id"),
    sourceId: stringField(row, "source_id"),
    proofType: stringField(row, "proof_type"),
    sourceHash: stringField(row, "source_hash"),
    excerptHash: stringField(row, "excerpt_hash"),
    supportStatus: stringField(row, "support_status") as ProofSupportStatus,
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
