import type { DatabaseSync } from "node:sqlite";

export type ClaimEdgeCreatedBy =
  | "deterministic_rule"
  | "model_suggestion"
  | "user_confirmation"
  | "test_verification"
  | "grape_observed"
  | "trusted_import"
  | "review_metadata"
  | "legacy";

export interface ClaimEdgeAuthorityRecord {
  readonly createdBy: ClaimEdgeCreatedBy;
  readonly confidence: number;
  readonly reason: string;
  readonly metadataJson: string;
  readonly createdAt: string;
}

export function insertClaimEdgeAuthority(
  database: DatabaseSync,
  edgeId: string,
  authority: ClaimEdgeAuthorityRecord
): void {
  database
    .prepare(
      [
        "INSERT OR IGNORE INTO claim_edge_authority",
        "(edge_id, created_by, confidence, reason, metadata_json, created_at)",
        "VALUES (?, ?, ?, ?, ?, ?)"
      ].join(" ")
    )
    .run(edgeId, authority.createdBy, authority.confidence, authority.reason, authority.metadataJson, authority.createdAt);
}

export function claimEdgeAuthoritySelectSql(): string {
  return [
    "claim_edge_authority.created_by AS authority_created_by",
    "claim_edge_authority.confidence AS authority_confidence",
    "claim_edge_authority.reason AS authority_reason",
    "claim_edge_authority.metadata_json AS authority_metadata_json",
    "claim_edge_authority.created_at AS authority_created_at"
  ].join(", ");
}

export function claimEdgeAuthorityJoinSql(): string {
  return "LEFT JOIN claim_edge_authority ON claim_edge_authority.edge_id = claim_edges.edge_id";
}

export function mapClaimEdgeAuthority(row: Record<string, unknown>): ClaimEdgeAuthorityRecord | undefined {
  const createdBy = optionalStringField(row, "authority_created_by");
  if (!createdBy) return undefined;
  return {
    createdBy: createdBy as ClaimEdgeCreatedBy,
    confidence: numberField(row, "authority_confidence"),
    reason: stringField(row, "authority_reason"),
    metadataJson: stringField(row, "authority_metadata_json"),
    createdAt: stringField(row, "authority_created_at")
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
