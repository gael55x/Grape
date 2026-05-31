import type { DatabaseSync } from "node:sqlite";

import type {
  ContextArtifactRecord,
  ContextDependencyKind,
  ContextDependencyRecord,
  StorageRepositories
} from "../repositories.js";

export function createContextArtifactStorageRepositories(
  database: DatabaseSync
): Pick<StorageRepositories, "contextArtifacts" | "contextDependencies"> {
  return {
    contextArtifacts: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO context_artifacts",
              [
                "(artifact_id, session_id, snapshot_id, artifact_hash, dependency_manifest_hash,",
                "task_type, risk_overlays_json, warnings_json, unsafe_reasons_json, created_at)"
              ].join(" "),
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.artifactId,
            record.sessionId,
            record.snapshotId,
            record.artifactHash,
            record.dependencyManifestHash,
            record.taskType,
            record.riskOverlaysJson,
            record.warningsJson,
            record.unsafeReasonsJson,
            record.createdAt
          );
      },
      get(artifactId) {
        return mapContextArtifact(
          database
            .prepare("SELECT * FROM context_artifacts WHERE artifact_id = ?")
            .get(artifactId) as Record<string, unknown> | undefined
        );
      },
      list() {
        return (
          database
            .prepare("SELECT * FROM context_artifacts ORDER BY created_at DESC, artifact_id DESC")
            .all() as Array<Record<string, unknown>>
        ).map(mapContextArtifactRequired);
      },
      listBySession(sessionId) {
        return (
          database
            .prepare(
              "SELECT * FROM context_artifacts WHERE session_id = ? ORDER BY created_at DESC, artifact_id DESC"
            )
            .all(sessionId) as Array<Record<string, unknown>>
        ).map(mapContextArtifactRequired);
      }
    },
    contextDependencies: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO context_dependencies",
              "(dependency_id, artifact_id, dependency_kind, dependency_ref, dependency_hash, scope_json, created_at)",
              "VALUES (?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.dependencyId,
            record.artifactId,
            record.dependencyKind,
            record.dependencyRef,
            record.dependencyHash,
            record.scopeJson,
            record.createdAt
          );
      },
      listByArtifact(artifactId) {
        return (
          database
            .prepare("SELECT * FROM context_dependencies WHERE artifact_id = ? ORDER BY dependency_id ASC")
            .all(artifactId) as Array<Record<string, unknown>>
        ).map(mapContextDependency);
      }
    }
  };
}

function mapContextArtifact(row: Record<string, unknown> | undefined): ContextArtifactRecord | undefined {
  if (!row) return undefined;
  return mapContextArtifactRequired(row);
}

function mapContextArtifactRequired(row: Record<string, unknown>): ContextArtifactRecord {
  return {
    artifactId: stringField(row, "artifact_id"),
    sessionId: stringField(row, "session_id"),
    snapshotId: stringField(row, "snapshot_id"),
    artifactHash: stringField(row, "artifact_hash"),
    dependencyManifestHash: stringField(row, "dependency_manifest_hash"),
    taskType: stringField(row, "task_type") as ContextArtifactRecord["taskType"],
    riskOverlaysJson: stringField(row, "risk_overlays_json"),
    warningsJson: stringField(row, "warnings_json"),
    unsafeReasonsJson: stringField(row, "unsafe_reasons_json"),
    createdAt: stringField(row, "created_at")
  };
}

function mapContextDependency(row: Record<string, unknown>): ContextDependencyRecord {
  return {
    dependencyId: stringField(row, "dependency_id"),
    artifactId: stringField(row, "artifact_id"),
    dependencyKind: stringField(row, "dependency_kind") as ContextDependencyKind,
    dependencyRef: stringField(row, "dependency_ref"),
    dependencyHash: stringField(row, "dependency_hash"),
    scopeJson: stringField(row, "scope_json"),
    createdAt: stringField(row, "created_at")
  };
}

function stringField(row: Record<string, unknown>, key: string): string {
  return String(row[key]);
}
