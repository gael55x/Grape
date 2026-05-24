import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationDir = path.join(root, "src/core/storage/migrations");
const manifestPath = path.join(root, "src/core/storage/migrations.ts");
const errors = [];

const alphaTables = [
  "schema_migrations",
  "projects",
  "repos",
  "repo_snapshots",
  "worktree_states",
  "sources",
  "source_rejections",
  "claims",
  "claim_candidates",
  "proofs",
  "claim_edges",
  "project_rules",
  "context_sessions",
  "session_events",
  "context_artifacts",
  "context_dependencies",
  "context_sent_items",
  "omitted_context_items",
  "context_pack_items",
  "audit_events"
];

const forbiddenTableNames = [
  "rules",
  "sessions",
  "artifacts",
  "artifact_dependencies",
  "sent_items",
  "omitted_items"
];

function read(relPath) {
  return readFileSync(path.join(root, relPath), "utf8");
}

function extractManifestEntries() {
  const source = readFileSync(manifestPath, "utf8");
  const entries = [];
  const objectPattern = /{\s*id:\s*"([^"]+)",\s*filename:\s*"([^"]+)",/g;

  for (const match of source.matchAll(objectPattern)) {
    entries.push({ id: match[1], filename: match[2] });
  }

  if (entries.length === 0) {
    errors.push("storageMigrationReferences must list at least one migration");
  }

  return entries;
}

function expect(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const files = readdirSync(migrationDir).filter((file) => file.endsWith(".sql")).sort();
const manifestEntries = extractManifestEntries();
const manifestFiles = new Set(manifestEntries.map((entry) => entry.filename));

for (const file of files) {
  expect(/^\d{4}_[a-z0-9_]+\.sql$/.test(file), `invalid migration filename: ${file}`);
  expect(manifestFiles.has(file), `migration file is missing from manifest: ${file}`);
}

for (const entry of manifestEntries) {
  const expectedId = entry.filename.slice(0, 4);
  expect(entry.id === expectedId, `manifest id ${entry.id} does not match filename ${entry.filename}`);
  expect(files.includes(entry.filename), `manifest references missing migration file: ${entry.filename}`);
}

const firstMigration = read("src/core/storage/migrations/0001_alpha_storage_subset.sql");
expect(firstMigration.includes("PRAGMA foreign_keys = ON;"), "first migration must enable foreign key enforcement");
expect(firstMigration.includes("checksum_sha256 TEXT NOT NULL"), "schema_migrations must store checksums");
expect(firstMigration.includes("applied_at TEXT NOT NULL"), "schema_migrations must store applied timestamps");

for (const table of alphaTables) {
  expect(
    firstMigration.includes(`CREATE TABLE IF NOT EXISTS ${table} (`),
    `first migration must create alpha table: ${table}`
  );
}

for (const table of forbiddenTableNames) {
  expect(
    !firstMigration.includes(`CREATE TABLE IF NOT EXISTS ${table} (`),
    `migration must use canonical table name instead of ${table}`
  );
}

for (const forbidden of ["DROP TABLE", "DELETE FROM", "UPDATE "]) {
  expect(!firstMigration.includes(forbidden), `initial migration must not contain ${forbidden.trim()}`);
}

expect(
  (firstMigration.match(/CREATE INDEX IF NOT EXISTS/g) ?? []).length >= 5,
  "first migration should define basic lookup indexes"
);

if (errors.length > 0) {
  console.error("storage migration checks failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("storage migrations ok");
