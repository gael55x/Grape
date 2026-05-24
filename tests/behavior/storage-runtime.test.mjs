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
} from "../../.tmp/build/src/core/storage/index.js";

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
    assert.deepEqual(result.applied, [
      { id: "0001", filename: "0001_alpha_storage_subset.sql" }
    ]);
    assert.deepEqual(result.pendingAfterApply, []);

    assert.equal(database.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    assert.equal(database.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
    assert.equal(database.prepare("SELECT count(*) AS count FROM schema_migrations").get().count, 1);
    assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE name = 'context_sent_items'").get());
  });
});

test("storage runtime skips already applied migrations", () => {
  withDatabase((database) => {
    const sources = migrationSources();
    applyStorageMigrations(database, sources, () => "2026-05-24T00:00:00.000Z");
    const result = applyStorageMigrations(database, sources, () => "2026-05-24T00:00:01.000Z");

    assert.equal(result.alreadyApplied.length, 1);
    assert.deepEqual(result.applied, []);
    assert.deepEqual(readAppliedStorageMigrations(database).map((migration) => migration.id), ["0001"]);
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
