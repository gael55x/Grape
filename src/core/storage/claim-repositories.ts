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

export type ClaimEdgeType =
  | "supersedes"
  | "contradicts"
  | "depends_on"
  | "validated_by"
  | "caused_by"
  | "related_to"
  | "narrows"
  | "broadens"
  | "needs_review"
  | "violates"
  | "coexists_with"
  | "variant_of"
  | "unknown_scope_overlap";

export interface ClaimEdgeRecord {
  readonly edgeId: string;
  readonly sourceClaimId: string;
  readonly targetClaimId: string;
  readonly edgeType: ClaimEdgeType;
  readonly createdAt: string;
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
  readonly claimEdges: {
    insertOrIgnore(record: ClaimEdgeRecord): boolean;
    get(edgeId: string): ClaimEdgeRecord | undefined;
    listConflictEdges(): readonly ClaimEdgeRecord[];
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
    },
    claimEdges: {
      insertOrIgnore(record) {
        const result = database
          .prepare(
            [
              "INSERT OR IGNORE INTO claim_edges",
              "(edge_id, source_claim_id, target_claim_id, edge_type, created_at)",
              "VALUES (?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(record.edgeId, record.sourceClaimId, record.targetClaimId, record.edgeType, record.createdAt);
        return result.changes === 1;
      },
      get(edgeId) {
        return mapClaimEdge(
          database
            .prepare("SELECT * FROM claim_edges WHERE edge_id = ?")
            .get(edgeId) as Record<string, unknown> | undefined
        );
      },
      listConflictEdges() {
        return (
          database
            .prepare(
              [
                "SELECT * FROM claim_edges",
                "WHERE edge_type IN ('contradicts', 'needs_review', 'violates', 'unknown_scope_overlap')",
                "ORDER BY created_at DESC, edge_id ASC"
              ].join(" ")
            )
            .all() as Array<Record<string, unknown>>
        ).map(mapRequiredClaimEdge);
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

function mapClaimEdge(row: Record<string, unknown> | undefined): ClaimEdgeRecord | undefined {
  if (!row) return undefined;
  return mapRequiredClaimEdge(row);
}

function mapRequiredClaimEdge(row: Record<string, unknown>): ClaimEdgeRecord {
  return {
    edgeId: stringField(row, "edge_id"),
    sourceClaimId: stringField(row, "source_claim_id"),
    targetClaimId: stringField(row, "target_claim_id"),
    edgeType: stringField(row, "edge_type") as ClaimEdgeType,
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
