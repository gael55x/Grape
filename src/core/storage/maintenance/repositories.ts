import type { DatabaseSync } from "node:sqlite";

import { applySqliteConnectionPolicy } from "../sqlite-policy.js";

export interface StorageRetentionLimit {
  readonly maxAgeDays: number;
  readonly maxRows: number;
}

export type ContextArtifactRetentionReason =
  | "age"
  | "row_limit"
  | "age_and_row_limit";

export type ContextArtifactRetentionProtection =
  | "latest_per_session"
  | "active_sent_context"
  | "restorable_omitted_context"
  | "locked_session";

export type CompressionRetentionReason =
  | "age"
  | "input_row_limit"
  | "age_and_input_row_limit";

export type CompressionRetentionProtection = "referenced_by_context_artifact";

export interface ContextArtifactRetentionCandidate {
  readonly artifactId: string;
  readonly sessionId: string;
  readonly createdAt: string;
  readonly reason: ContextArtifactRetentionReason;
}

export interface ContextArtifactRetentionProtectedArtifact {
  readonly artifactId: string;
  readonly sessionId: string;
  readonly createdAt: string;
  readonly reason: ContextArtifactRetentionReason;
  readonly protection: ContextArtifactRetentionProtection;
}

export interface ContextArtifactRetentionPlan {
  readonly cutoff: string;
  readonly totalArtifacts: number;
  readonly retentionMatchedArtifacts: number;
  readonly candidateArtifacts: readonly ContextArtifactRetentionCandidate[];
  readonly protectedArtifacts: readonly ContextArtifactRetentionProtectedArtifact[];
  readonly rowCounts: {
    readonly contextArtifacts: number;
    readonly contextDependencies: number;
    readonly contextSentItems: number;
    readonly omittedContextItems: number;
    readonly contextPackItems: number;
  };
}

export interface CompressionRetentionCandidate {
  readonly compressionId: string;
  readonly artifactType: string;
  readonly createdAt: string;
  readonly inputRows: number;
  readonly reason: CompressionRetentionReason;
}

export interface CompressionRetentionProtectedArtifact {
  readonly compressionId: string;
  readonly artifactType: string;
  readonly createdAt: string;
  readonly inputRows: number;
  readonly reason: CompressionRetentionReason;
  readonly protection: CompressionRetentionProtection;
}

export interface CompressionRetentionPlan {
  readonly cutoff: string;
  readonly totalArtifacts: number;
  readonly totalInputRows: number;
  readonly retentionMatchedArtifacts: number;
  readonly candidateArtifacts: readonly CompressionRetentionCandidate[];
  readonly protectedArtifacts: readonly CompressionRetentionProtectedArtifact[];
  readonly rowCounts: {
    readonly compressionArtifacts: number;
    readonly compressionInputs: number;
  };
}

export interface MaintenanceStorageRepositories {
  readonly retention: {
    planContextArtifactCompaction(input: {
      readonly now: string;
      readonly limit: StorageRetentionLimit;
    }): ContextArtifactRetentionPlan;
    deleteContextArtifacts(artifactIds: readonly string[]): number;
    planCompressionCompaction(input: {
      readonly now: string;
      readonly limit: StorageRetentionLimit;
      readonly ignoredContextArtifactIds?: readonly string[];
    }): CompressionRetentionPlan;
    deleteCompressionArtifacts(compressionIds: readonly string[]): number;
  };
}

interface FlaggedArtifactRow {
  readonly artifactId: string;
  readonly sessionId: string;
  readonly createdAt: string;
  readonly ageExpired: boolean;
  readonly rowExpired: boolean;
  readonly isLatestForSession: boolean;
  readonly hasActiveSentContext: boolean;
  readonly hasRestorableOmittedContext: boolean;
  readonly sessionLocked: boolean;
}

interface FlaggedCompressionArtifactRow {
  readonly compressionId: string;
  readonly artifactType: string;
  readonly createdAt: string;
  readonly inputRows: number;
  readonly ageExpired: boolean;
  readonly inputRowsExpired: boolean;
  readonly referencedByContextArtifact: boolean;
}

export function createMaintenanceStorageRepositories(database: DatabaseSync): MaintenanceStorageRepositories {
  applySqliteConnectionPolicy(database);

  return {
    retention: {
      planContextArtifactCompaction(input) {
        const cutoff = retentionCutoff(input.now, input.limit.maxAgeDays);
        const rows = listFlaggedArtifacts(database, {
          cutoff,
          maxRows: input.limit.maxRows
        });
        const retentionMatched = rows.filter((row) => row.ageExpired || row.rowExpired);
        const candidateArtifacts: ContextArtifactRetentionCandidate[] = [];
        const protectedArtifacts: ContextArtifactRetentionProtectedArtifact[] = [];

        for (const row of retentionMatched) {
          const reason = retentionReason(row);
          const protection = retentionProtection(row);
          if (protection) {
            protectedArtifacts.push({
              artifactId: row.artifactId,
              sessionId: row.sessionId,
              createdAt: row.createdAt,
              reason,
              protection
            });
          } else {
            candidateArtifacts.push({
              artifactId: row.artifactId,
              sessionId: row.sessionId,
              createdAt: row.createdAt,
              reason
            });
          }
        }

        const candidateArtifactIds = candidateArtifacts.map((artifact) => artifact.artifactId);
        return {
          cutoff,
          totalArtifacts: rows.length,
          retentionMatchedArtifacts: retentionMatched.length,
          candidateArtifacts,
          protectedArtifacts,
          rowCounts: candidateRowCounts(database, candidateArtifactIds)
        };
      },
      deleteContextArtifacts(artifactIds) {
        if (artifactIds.length === 0) return 0;
        const placeholders = artifactIds.map(() => "?").join(", ");
        return Number(
          database
            .prepare(`DELETE FROM context_artifacts WHERE artifact_id IN (${placeholders})`)
            .run(...artifactIds).changes
        );
      },
      planCompressionCompaction(input) {
        const cutoff = retentionCutoff(input.now, input.limit.maxAgeDays);
        const rows = listFlaggedCompressionArtifacts(database, {
          cutoff,
          maxInputRows: input.limit.maxRows,
          ignoredContextArtifactIds: input.ignoredContextArtifactIds ?? []
        });
        const retentionMatched = rows.filter((row) => row.ageExpired || row.inputRowsExpired);
        const candidateArtifacts: CompressionRetentionCandidate[] = [];
        const protectedArtifacts: CompressionRetentionProtectedArtifact[] = [];

        for (const row of retentionMatched) {
          const reason = compressionRetentionReason(row);
          if (row.referencedByContextArtifact) {
            protectedArtifacts.push({
              compressionId: row.compressionId,
              artifactType: row.artifactType,
              createdAt: row.createdAt,
              inputRows: row.inputRows,
              reason,
              protection: "referenced_by_context_artifact"
            });
          } else {
            candidateArtifacts.push({
              compressionId: row.compressionId,
              artifactType: row.artifactType,
              createdAt: row.createdAt,
              inputRows: row.inputRows,
              reason
            });
          }
        }

        const compressionIds = candidateArtifacts.map((artifact) => artifact.compressionId);
        return {
          cutoff,
          totalArtifacts: rows.length,
          totalInputRows: rows.reduce((total, row) => total + row.inputRows, 0),
          retentionMatchedArtifacts: retentionMatched.length,
          candidateArtifacts,
          protectedArtifacts,
          rowCounts: compressionCandidateRowCounts(database, compressionIds)
        };
      },
      deleteCompressionArtifacts(compressionIds) {
        if (compressionIds.length === 0) return 0;
        const placeholders = compressionIds.map(() => "?").join(", ");
        return Number(
          database
            .prepare(`DELETE FROM compression_artifacts WHERE compression_id IN (${placeholders})`)
            .run(...compressionIds).changes
        );
      }
    }
  };
}

function retentionCutoff(now: string, maxAgeDays: number): string {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error("invalid retention timestamp.");
  return new Date(nowMs - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
}

function listFlaggedArtifacts(
  database: DatabaseSync,
  input: {
    readonly cutoff: string;
    readonly maxRows: number;
  }
): FlaggedArtifactRow[] {
  return (
    database
      .prepare(
        [
          "WITH ranked_artifacts AS (",
          "SELECT",
          "artifact.artifact_id,",
          "artifact.session_id,",
          "artifact.created_at,",
          "session.lock_status,",
          "ROW_NUMBER() OVER (ORDER BY artifact.created_at DESC, artifact.artifact_id DESC) AS retention_rank",
          "FROM context_artifacts artifact",
          "JOIN context_sessions session ON session.session_id = artifact.session_id",
          ")",
          "SELECT",
          "ranked.artifact_id,",
          "ranked.session_id,",
          "ranked.created_at,",
          "ranked.created_at < ? AS age_expired,",
          "ranked.retention_rank > ? AS row_expired,",
          [
            "NOT EXISTS (",
            "SELECT 1 FROM context_artifacts newer",
            "WHERE newer.session_id = ranked.session_id",
            "AND (",
            "newer.created_at > ranked.created_at",
            "OR (newer.created_at = ranked.created_at AND newer.artifact_id > ranked.artifact_id)",
            ")",
            ") AS is_latest_for_session,"
          ].join(" "),
          [
            "EXISTS (",
            "SELECT 1 FROM context_sent_items sent",
            "WHERE sent.artifact_id = ranked.artifact_id",
            "AND sent.session_id = ranked.session_id",
            "AND NOT EXISTS (",
            "SELECT 1 FROM context_pack_items invalidation",
            "WHERE invalidation.session_id = sent.session_id",
            "AND invalidation.diff_state = 'INVALIDATE_PREVIOUS'",
            "AND invalidation.invalidates_sent_item_id = sent.sent_item_id",
            ")",
            ") AS has_active_sent_context,"
          ].join(" "),
          [
            "EXISTS (",
            "SELECT 1 FROM omitted_context_items omitted",
            "WHERE omitted.artifact_id = ranked.artifact_id",
            "AND omitted.session_id = ranked.session_id",
            "AND omitted.can_restore = 1",
            "AND omitted.restore_id IS NOT NULL",
            ") AS has_restorable_omitted_context,"
          ].join(" "),
          "ranked.lock_status IN ('locked', 'contended') AS session_locked",
          "FROM ranked_artifacts ranked",
          "ORDER BY ranked.created_at DESC, ranked.artifact_id DESC"
        ].join(" ")
      )
      .all(input.cutoff, input.maxRows) as Array<Record<string, unknown>>
  ).map(mapFlaggedArtifactRow);
}

function mapFlaggedArtifactRow(row: Record<string, unknown>): FlaggedArtifactRow {
  return {
    artifactId: stringColumn(row, "artifact_id"),
    sessionId: stringColumn(row, "session_id"),
    createdAt: stringColumn(row, "created_at"),
    ageExpired: boolColumn(row, "age_expired"),
    rowExpired: boolColumn(row, "row_expired"),
    isLatestForSession: boolColumn(row, "is_latest_for_session"),
    hasActiveSentContext: boolColumn(row, "has_active_sent_context"),
    hasRestorableOmittedContext: boolColumn(row, "has_restorable_omitted_context"),
    sessionLocked: boolColumn(row, "session_locked")
  };
}

function retentionReason(row: FlaggedArtifactRow): ContextArtifactRetentionReason {
  if (row.ageExpired && row.rowExpired) return "age_and_row_limit";
  if (row.ageExpired) return "age";
  return "row_limit";
}

function retentionProtection(
  row: FlaggedArtifactRow
): ContextArtifactRetentionProtection | undefined {
  if (row.isLatestForSession) return "latest_per_session";
  if (row.hasActiveSentContext) return "active_sent_context";
  if (row.hasRestorableOmittedContext) return "restorable_omitted_context";
  if (row.sessionLocked) return "locked_session";
  return undefined;
}

function listFlaggedCompressionArtifacts(
  database: DatabaseSync,
  input: {
    readonly cutoff: string;
    readonly maxInputRows: number;
    readonly ignoredContextArtifactIds: readonly string[];
  }
): FlaggedCompressionArtifactRow[] {
  const ignoredPlaceholders = input.ignoredContextArtifactIds.map(() => "?").join(", ");
  const ignoredClause =
    input.ignoredContextArtifactIds.length > 0
      ? `AND dependency.artifact_id NOT IN (${ignoredPlaceholders})`
      : "";
  return (
    database
      .prepare(
        [
          "WITH artifact_inputs AS (",
          "SELECT",
          "artifact.compression_id,",
          "artifact.artifact_type,",
          "artifact.created_at,",
          "count(input.compression_input_id) AS input_rows",
          "FROM compression_artifacts artifact",
          "LEFT JOIN compression_inputs input ON input.compression_id = artifact.compression_id",
          "GROUP BY artifact.compression_id, artifact.artifact_type, artifact.created_at",
          "),",
          "ranked_artifacts AS (",
          "SELECT",
          "artifact_inputs.*,",
          [
            "sum(input_rows) OVER (",
            "ORDER BY created_at DESC, compression_id DESC",
            "ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW",
            ") AS retained_input_rows"
          ].join(" "),
          "FROM artifact_inputs",
          ")",
          "SELECT",
          "ranked.compression_id,",
          "ranked.artifact_type,",
          "ranked.created_at,",
          "ranked.input_rows,",
          "ranked.created_at < ? AS age_expired,",
          "ranked.retained_input_rows > ? AS input_rows_expired,",
          [
            "EXISTS (",
            "SELECT 1 FROM context_dependencies dependency",
            "JOIN context_artifacts artifact ON artifact.artifact_id = dependency.artifact_id",
            "WHERE dependency.dependency_kind = 'compression_artifact'",
            "AND dependency.dependency_ref = ranked.compression_id",
            ignoredClause,
            ") AS referenced_by_context_artifact"
          ].join(" "),
          "FROM ranked_artifacts ranked",
          "ORDER BY ranked.created_at DESC, ranked.compression_id DESC"
        ].join(" ")
      )
      .all(input.cutoff, input.maxInputRows, ...input.ignoredContextArtifactIds) as Array<Record<string, unknown>>
  ).map(mapFlaggedCompressionArtifactRow);
}

function mapFlaggedCompressionArtifactRow(row: Record<string, unknown>): FlaggedCompressionArtifactRow {
  return {
    compressionId: stringColumn(row, "compression_id"),
    artifactType: stringColumn(row, "artifact_type"),
    createdAt: stringColumn(row, "created_at"),
    inputRows: Number(row.input_rows),
    ageExpired: boolColumn(row, "age_expired"),
    inputRowsExpired: boolColumn(row, "input_rows_expired"),
    referencedByContextArtifact: boolColumn(row, "referenced_by_context_artifact")
  };
}

function compressionRetentionReason(row: FlaggedCompressionArtifactRow): CompressionRetentionReason {
  if (row.ageExpired && row.inputRowsExpired) return "age_and_input_row_limit";
  if (row.ageExpired) return "age";
  return "input_row_limit";
}

function candidateRowCounts(
  database: DatabaseSync,
  artifactIds: readonly string[]
): ContextArtifactRetentionPlan["rowCounts"] {
  if (artifactIds.length === 0) {
    return {
      contextArtifacts: 0,
      contextDependencies: 0,
      contextSentItems: 0,
      omittedContextItems: 0,
      contextPackItems: 0
    };
  }

  return {
    contextArtifacts: artifactIds.length,
    contextDependencies: countRowsByArtifactIds(database, "context_dependencies", "artifact_id", artifactIds),
    contextSentItems: countRowsByArtifactIds(database, "context_sent_items", "artifact_id", artifactIds),
    omittedContextItems: countRowsByArtifactIds(database, "omitted_context_items", "artifact_id", artifactIds),
    contextPackItems: countRowsByArtifactIds(database, "context_pack_items", "artifact_id", artifactIds)
  };
}

function compressionCandidateRowCounts(
  database: DatabaseSync,
  compressionIds: readonly string[]
): CompressionRetentionPlan["rowCounts"] {
  if (compressionIds.length === 0) {
    return {
      compressionArtifacts: 0,
      compressionInputs: 0
    };
  }

  return {
    compressionArtifacts: compressionIds.length,
    compressionInputs: countRowsByArtifactIds(database, "compression_inputs", "compression_id", compressionIds)
  };
}

function countRowsByArtifactIds(
  database: DatabaseSync,
  tableName: string,
  columnName: string,
  artifactIds: readonly string[]
): number {
  const placeholders = artifactIds.map(() => "?").join(", ");
  const row = database
    .prepare(`SELECT count(*) AS count FROM ${tableName} WHERE ${columnName} IN (${placeholders})`)
    .get(...artifactIds) as Record<string, unknown>;
  return Number(row.count);
}

function stringColumn(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`expected string column: ${key}`);
  return value;
}

function boolColumn(row: Record<string, unknown>, key: string): boolean {
  return Number(row[key]) === 1;
}
