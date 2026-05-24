import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import {
  planPendingStorageMigrations,
  type AppliedStorageMigration,
  type StorageMigrationDefinition
} from "./migration-plan.js";
import { createSqlitePragmaStatements } from "./sqlite-policy.js";

export interface StorageMigrationSource extends StorageMigrationDefinition {
  readonly sql: string;
}

export interface AppliedStorageMigrationResult {
  readonly id: string;
  readonly filename: string;
}

export interface ApplyStorageMigrationsResult {
  readonly alreadyApplied: readonly StorageMigrationDefinition[];
  readonly applied: readonly AppliedStorageMigrationResult[];
  readonly pendingAfterApply: readonly StorageMigrationDefinition[];
}

export function applyStorageMigrations(
  database: DatabaseSync,
  migrations: readonly StorageMigrationSource[],
  now: () => string = () => new Date().toISOString()
): ApplyStorageMigrationsResult {
  database.exec(createSqlitePragmaStatements().join("\n"));

  assertMigrationSourceChecksums(migrations);
  const appliedBefore = readAppliedStorageMigrations(database);
  const plan = planPendingStorageMigrations(migrations, appliedBefore);
  const applied: AppliedStorageMigrationResult[] = [];

  for (const migration of plan.pending) {
    const source = migrations.find((candidate) => candidate.id === migration.id);
    if (!source) {
      throw new Error(`migration SQL source is missing: ${migration.id}`);
    }

    database.exec("BEGIN IMMEDIATE;");
    try {
      database.exec(source.sql);
      database
        .prepare(
          [
            "INSERT INTO schema_migrations",
            "(id, filename, checksum_sha256, applied_at)",
            "VALUES (?, ?, ?, ?)"
          ].join(" ")
        )
        .run(source.id, source.filename, source.checksumSha256, now());
      database.exec("COMMIT;");
      applied.push({ id: source.id, filename: source.filename });
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }

  return {
    alreadyApplied: plan.alreadyApplied,
    applied,
    pendingAfterApply: []
  };
}

function assertMigrationSourceChecksums(migrations: readonly StorageMigrationSource[]): void {
  for (const migration of migrations) {
    const actualChecksum = createHash("sha256").update(migration.sql).digest("hex");
    if (actualChecksum !== migration.checksumSha256) {
      throw new Error(`migration checksum does not match SQL source: ${migration.id}`);
    }
  }
}

export function readAppliedStorageMigrations(database: DatabaseSync): readonly AppliedStorageMigration[] {
  if (!hasSchemaMigrationsTable(database)) {
    return [];
  }

  const rows = database
    .prepare(
      [
        "SELECT id, filename, checksum_sha256 AS checksumSha256, applied_at AS appliedAt",
        "FROM schema_migrations",
        "ORDER BY id ASC"
      ].join(" ")
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    filename: String(row.filename),
    checksumSha256: String(row.checksumSha256),
    appliedAt: String(row.appliedAt)
  }));
}

function hasSchemaMigrationsTable(database: DatabaseSync): boolean {
  const row = database
    .prepare(
      [
        "SELECT name",
        "FROM sqlite_master",
        "WHERE type = 'table' AND name = 'schema_migrations'",
        "LIMIT 1"
      ].join(" ")
    )
    .get();

  return row !== undefined;
}
