import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  applyStorageMigrations,
  readAppliedStorageMigrations,
  storageMigrationReferences
} from "../../../.tmp/build/src/core/storage/index.js";

function migrationSources() {
  return storageMigrationReferences.map((migration) => ({
    ...migration,
    sql: readFileSync(
      path.join(process.cwd(), "src/core/storage/migrations", migration.filename),
      "utf8"
    )
  }));
}

function withDatabase(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-sqlite-"));
  const databasePath = path.join(dir, "grape.db");
  const database = new DatabaseSync(databasePath);

  try {
    fn(database);
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test("storage runtime applies migrations from an empty database", () => {
  withDatabase((database) => {
    const result = applyStorageMigrations(database, migrationSources(), () => "2026-05-24T00:00:00.000Z");

    assert.deepEqual(result.alreadyApplied, []);
    assert.deepEqual(
      result.applied,
      storageMigrationReferences.map((migration) => ({ id: migration.id, filename: migration.filename }))
    );
    assert.deepEqual(result.pendingAfterApply, []);

    assert.equal(database.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    assert.equal(database.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
    assert.equal(
      database.prepare("SELECT count(*) AS count FROM schema_migrations").get().count,
      storageMigrationReferences.length
    );
    assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE name = 'context_sent_items'").get());
    assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE name = 'symbol_nodes'").get());
    assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE name = 'fts_entries'").get());
    assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE name = 'fts_entry_text'").get());
    assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE name = 'compression_artifacts'").get());
    assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE name = 'compression_inputs'").get());
  });
});

test("storage runtime skips already applied migrations", () => {
  withDatabase((database) => {
    const sources = migrationSources();
    applyStorageMigrations(database, sources, () => "2026-05-24T00:00:00.000Z");
    const result = applyStorageMigrations(database, sources, () => "2026-05-24T00:00:01.000Z");

    assert.equal(result.alreadyApplied.length, storageMigrationReferences.length);
    assert.deepEqual(result.applied, []);
    assert.deepEqual(
      readAppliedStorageMigrations(database).map((migration) => migration.id),
      storageMigrationReferences.map((migration) => migration.id)
    );
  });
});

test("claim_edge_authority_migration_applies_from_previous_schema", () => {
  withDatabase((database) => {
    const sources = migrationSources();
    applyStorageMigrations(database, sources.slice(0, -1), () => "2026-05-24T00:00:00.000Z");
    database
      .prepare(
        [
          "INSERT INTO claims",
          "(claim_id, subject, claim_type, claim_text, scope_json, scope_hash, verification_status, created_at, updated_at)",
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ].join(" ")
      )
      .run("claim-a", "src/a.ts", "repository_source_excerpt_exists", "Claim A", "{}", "a".repeat(64), "verified", "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");
    database
      .prepare(
        [
          "INSERT INTO claims",
          "(claim_id, subject, claim_type, claim_text, scope_json, scope_hash, verification_status, created_at, updated_at)",
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ].join(" ")
      )
      .run("claim-b", "src/b.ts", "repository_source_excerpt_exists", "Claim B", "b".repeat(64), "b".repeat(64), "verified", "2026-05-24T00:00:00.000Z", "2026-05-24T00:00:00.000Z");
    database
      .prepare(
        [
          "INSERT INTO claim_edges",
          "(edge_id, source_claim_id, target_claim_id, edge_type, created_at)",
          "VALUES (?, ?, ?, ?, ?)"
        ].join(" ")
      )
      .run("edge-legacy", "claim-a", "claim-b", "contradicts", "2026-05-24T00:00:00.000Z");

    const result = applyStorageMigrations(database, sources, () => "2026-05-24T00:00:01.000Z");

    assert.deepEqual(result.applied, [{ id: "0006", filename: "0006_claim_edge_authority.sql" }]);
    assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE name = 'claim_edge_authority'").get());
    assert.equal(
      database.prepare("SELECT count(*) AS count FROM claim_edges WHERE edge_id = 'edge-legacy'").get().count,
      1
    );
    assert.equal(
      database.prepare("SELECT count(*) AS count FROM claim_edge_authority WHERE edge_id = 'edge-legacy'").get().count,
      0
    );
  });
});

test("storage runtime rejects checksum drift before applying sql", () => {
  withDatabase((database) => {
    const [source] = migrationSources();

    assert.throws(
      () =>
        applyStorageMigrations(database, [
          {
            ...source,
            checksumSha256: "f".repeat(64)
          }
        ]),
      /checksum/
    );

    assert.equal(
      database.prepare("SELECT name FROM sqlite_master WHERE name = 'schema_migrations'").get(),
      undefined
    );
  });
});

test("storage runtime rejects non-empty databases without migration metadata", () => {
  withDatabase((database) => {
    database.exec("CREATE TABLE projects (project_id TEXT PRIMARY KEY);");

    assert.throws(
      () => applyStorageMigrations(database, migrationSources(), () => "2026-05-24T00:00:00.000Z"),
      /non-empty database without schema_migrations/
    );

    assert.equal(
      database.prepare("SELECT name FROM sqlite_master WHERE name = 'schema_migrations'").get(),
      undefined
    );
  });
});
