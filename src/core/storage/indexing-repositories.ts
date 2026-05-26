import type { DatabaseSync } from "node:sqlite";

import { applySqliteConnectionPolicy } from "./sqlite-policy.js";
import {
  createFtsEntriesRepository,
  type FtsEntriesRepository
} from "./fts-repositories.js";

export type SymbolKind =
  | "function"
  | "class"
  | "method"
  | "interface"
  | "type"
  | "variable"
  | "constant"
  | "module"
  | "route"
  | "unknown";

export type SymbolEdgeType =
  | "contains"
  | "imports"
  | "exports"
  | "calls"
  | "references"
  | "routes_to"
  | "configures";

export type SymbolConfidence = "high" | "medium" | "low";

export type SymbolDiscoveryMethod =
  | "ast"
  | "import_resolution"
  | "framework_extractor"
  | "config_scan"
  | "runtime_trace"
  | "manual"
  | "inferred";

export interface SymbolNodeRecord {
  readonly symbolId: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly sourceId: string;
  readonly path: string;
  readonly language: string;
  readonly name: string;
  readonly symbolKind: SymbolKind;
  readonly startLine: number;
  readonly endLine: number;
  readonly bodyHash?: string;
  readonly signatureHash?: string;
  readonly confidence: SymbolConfidence;
  readonly metadataJson: string;
  readonly createdAt: string;
}

export interface SymbolEdgeRecord {
  readonly edgeId: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly fromSymbolId: string;
  readonly toSymbolId?: string;
  readonly toRef?: string;
  readonly edgeType: SymbolEdgeType;
  readonly confidence: SymbolConfidence;
  readonly discoveryMethod: SymbolDiscoveryMethod;
  readonly metadataJson: string;
  readonly createdAt: string;
}

export interface IndexingStorageRepositories {
  readonly ftsEntries: FtsEntriesRepository;
  readonly symbolNodes: {
    insertOrIgnore(record: SymbolNodeRecord): boolean;
    get(symbolId: string): SymbolNodeRecord | undefined;
    listBySnapshot(snapshotId: string): readonly SymbolNodeRecord[];
  };
  readonly symbolEdges: {
    insertOrIgnore(record: SymbolEdgeRecord): boolean;
    get(edgeId: string): SymbolEdgeRecord | undefined;
    listBySnapshot(snapshotId: string): readonly SymbolEdgeRecord[];
  };
}

export function createIndexingStorageRepositories(database: DatabaseSync): IndexingStorageRepositories {
  applySqliteConnectionPolicy(database);

  return {
    ftsEntries: createFtsEntriesRepository(database),
    symbolNodes: {
      insertOrIgnore(record) {
        const result = database
          .prepare(
            [
              "INSERT OR IGNORE INTO symbol_nodes",
              [
                "(symbol_id, project_id, repo_id, snapshot_id, source_id, path, language, name, symbol_kind,",
                "start_line, end_line, body_hash, signature_hash, confidence, metadata_json, created_at)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.symbolId,
            record.projectId,
            record.repoId,
            record.snapshotId,
            record.sourceId,
            record.path,
            record.language,
            record.name,
            record.symbolKind,
            record.startLine,
            record.endLine,
            record.bodyHash ?? null,
            record.signatureHash ?? null,
            record.confidence,
            record.metadataJson,
            record.createdAt
          );
        return result.changes === 1;
      },
      get(symbolId) {
        return mapSymbolNode(
          database
            .prepare("SELECT * FROM symbol_nodes WHERE symbol_id = ?")
            .get(symbolId) as Record<string, unknown> | undefined
        );
      },
      listBySnapshot(snapshotId) {
        return (
          database
            .prepare("SELECT * FROM symbol_nodes WHERE snapshot_id = ? ORDER BY path ASC, start_line ASC, symbol_id ASC")
            .all(snapshotId) as Array<Record<string, unknown>>
        ).map(mapRequiredSymbolNode);
      }
    },
    symbolEdges: {
      insertOrIgnore(record) {
        const result = database
          .prepare(
            [
              "INSERT OR IGNORE INTO symbol_edges",
              [
                "(edge_id, project_id, repo_id, snapshot_id, from_symbol_id, to_symbol_id, to_ref, edge_type,",
                "confidence, discovery_method, metadata_json, created_at)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.edgeId,
            record.projectId,
            record.repoId,
            record.snapshotId,
            record.fromSymbolId,
            record.toSymbolId ?? null,
            record.toRef ?? null,
            record.edgeType,
            record.confidence,
            record.discoveryMethod,
            record.metadataJson,
            record.createdAt
          );
        return result.changes === 1;
      },
      get(edgeId) {
        return mapSymbolEdge(
          database
            .prepare("SELECT * FROM symbol_edges WHERE edge_id = ?")
            .get(edgeId) as Record<string, unknown> | undefined
        );
      },
      listBySnapshot(snapshotId) {
        return (
          database
            .prepare("SELECT * FROM symbol_edges WHERE snapshot_id = ? ORDER BY edge_type ASC, edge_id ASC")
            .all(snapshotId) as Array<Record<string, unknown>>
        ).map(mapRequiredSymbolEdge);
      }
    }
  };
}

function mapSymbolNode(row: Record<string, unknown> | undefined): SymbolNodeRecord | undefined {
  if (!row) return undefined;
  return mapRequiredSymbolNode(row);
}

function mapRequiredSymbolNode(row: Record<string, unknown>): SymbolNodeRecord {
  return {
    symbolId: stringField(row, "symbol_id"),
    projectId: stringField(row, "project_id"),
    repoId: stringField(row, "repo_id"),
    snapshotId: stringField(row, "snapshot_id"),
    sourceId: stringField(row, "source_id"),
    path: stringField(row, "path"),
    language: stringField(row, "language"),
    name: stringField(row, "name"),
    symbolKind: stringField(row, "symbol_kind") as SymbolKind,
    startLine: numberField(row, "start_line"),
    endLine: numberField(row, "end_line"),
    bodyHash: optionalStringField(row, "body_hash"),
    signatureHash: optionalStringField(row, "signature_hash"),
    confidence: stringField(row, "confidence") as SymbolConfidence,
    metadataJson: stringField(row, "metadata_json"),
    createdAt: stringField(row, "created_at")
  };
}

function mapSymbolEdge(row: Record<string, unknown> | undefined): SymbolEdgeRecord | undefined {
  if (!row) return undefined;
  return mapRequiredSymbolEdge(row);
}

function mapRequiredSymbolEdge(row: Record<string, unknown>): SymbolEdgeRecord {
  return {
    edgeId: stringField(row, "edge_id"),
    projectId: stringField(row, "project_id"),
    repoId: stringField(row, "repo_id"),
    snapshotId: stringField(row, "snapshot_id"),
    fromSymbolId: stringField(row, "from_symbol_id"),
    toSymbolId: optionalStringField(row, "to_symbol_id"),
    toRef: optionalStringField(row, "to_ref"),
    edgeType: stringField(row, "edge_type") as SymbolEdgeType,
    confidence: stringField(row, "confidence") as SymbolConfidence,
    discoveryMethod: stringField(row, "discovery_method") as SymbolDiscoveryMethod,
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

function numberField(row: Record<string, unknown>, key: string): number {
  return Number(row[key]);
}
