import type { DatabaseSync } from "node:sqlite";

import { applySqliteConnectionPolicy } from "./sqlite-policy.js";

export interface ClaimCandidateRecord {
  readonly candidateId: string;
  readonly sourceId?: string;
  readonly subject: string;
  readonly claimType: string;
  readonly claimText: string;
  readonly scopeJson: string;
  readonly rejectionReason?: string;
  readonly createdAt: string;
}

export interface ClaimRecord {
  readonly claimId: string;
  readonly subject: string;
  readonly claimType: string;
  readonly claimText: string;
  readonly scopeJson: string;
  readonly scopeHash: string;
  readonly verificationStatus: "verified" | "partially_verified" | "unverified" | "refuted" | "stale";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClaimStorageRepositories {
  readonly claimCandidates: {
    insertOrIgnore(record: ClaimCandidateRecord): boolean;
    get(candidateId: string): ClaimCandidateRecord | undefined;
    list(): readonly ClaimCandidateRecord[];
  };
  readonly claims: {
    insertOrIgnore(record: ClaimRecord): boolean;
    get(claimId: string): ClaimRecord | undefined;
    list(): readonly ClaimRecord[];
  };
}

export function createClaimStorageRepositories(database: DatabaseSync): ClaimStorageRepositories {
  applySqliteConnectionPolicy(database);

  return {
    claimCandidates: {
      insertOrIgnore(record) {
        const result = database
          .prepare(
            [
              "INSERT OR IGNORE INTO claim_candidates",
              "(candidate_id, source_id, subject, claim_type, claim_text, scope_json, rejection_reason, created_at)",
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.candidateId,
            record.sourceId ?? null,
            record.subject,
            record.claimType,
            record.claimText,
            record.scopeJson,
            record.rejectionReason ?? null,
            record.createdAt
          );
        return result.changes === 1;
      },
      get(candidateId) {
        return mapClaimCandidate(
          database
            .prepare("SELECT * FROM claim_candidates WHERE candidate_id = ?")
            .get(candidateId) as Record<string, unknown> | undefined
        );
      },
      list() {
        return (
          database
            .prepare("SELECT * FROM claim_candidates ORDER BY created_at DESC, candidate_id ASC")
            .all() as Array<Record<string, unknown>>
        ).map(mapRequiredClaimCandidate);
      }
    },
    claims: {
      insertOrIgnore(record) {
        const result = database
          .prepare(
            [
              "INSERT OR IGNORE INTO claims",
              [
                "(claim_id, subject, claim_type, claim_text, scope_json, scope_hash,",
                "verification_status, created_at, updated_at)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.claimId,
            record.subject,
            record.claimType,
            record.claimText,
            record.scopeJson,
            record.scopeHash,
            record.verificationStatus,
            record.createdAt,
            record.updatedAt
          );
        return result.changes === 1;
      },
      get(claimId) {
        return mapClaim(
          database
            .prepare("SELECT * FROM claims WHERE claim_id = ?")
            .get(claimId) as Record<string, unknown> | undefined
        );
      },
      list() {
        return (
          database
            .prepare("SELECT * FROM claims ORDER BY updated_at DESC, claim_id ASC")
            .all() as Array<Record<string, unknown>>
        ).map(mapRequiredClaim);
      }
    }
  };
}

function mapClaimCandidate(row: Record<string, unknown> | undefined): ClaimCandidateRecord | undefined {
  if (!row) return undefined;
  return mapRequiredClaimCandidate(row);
}

function mapRequiredClaimCandidate(row: Record<string, unknown>): ClaimCandidateRecord {
  return {
    candidateId: stringField(row, "candidate_id"),
    sourceId: optionalStringField(row, "source_id"),
    subject: stringField(row, "subject"),
    claimType: stringField(row, "claim_type"),
    claimText: stringField(row, "claim_text"),
    scopeJson: stringField(row, "scope_json"),
    rejectionReason: optionalStringField(row, "rejection_reason"),
    createdAt: stringField(row, "created_at")
  };
}

function mapClaim(row: Record<string, unknown> | undefined): ClaimRecord | undefined {
  if (!row) return undefined;
  return mapRequiredClaim(row);
}

function mapRequiredClaim(row: Record<string, unknown>): ClaimRecord {
  return {
    claimId: stringField(row, "claim_id"),
    subject: stringField(row, "subject"),
    claimType: stringField(row, "claim_type"),
    claimText: stringField(row, "claim_text"),
    scopeJson: stringField(row, "scope_json"),
    scopeHash: stringField(row, "scope_hash"),
    verificationStatus: stringField(row, "verification_status") as ClaimRecord["verificationStatus"],
    createdAt: stringField(row, "created_at"),
    updatedAt: stringField(row, "updated_at")
  };
}

function stringField(row: Record<string, unknown>, key: string): string {
  return String(row[key]);
}

function optionalStringField(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  return value === null || value === undefined ? undefined : String(value);
}
