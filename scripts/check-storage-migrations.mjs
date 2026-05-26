import { createHash } from "node:crypto";
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
  const objectPattern =
    /{\s*id:\s*"([^"]+)",\s*filename:\s*"([^"]+)",\s*checksumSha256:\s*"([^"]+)",/g;

  for (const match of source.matchAll(objectPattern)) {
    entries.push({ id: match[1], filename: match[2], checksumSha256: match[3] });
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

  const source = readFileSync(path.join(migrationDir, file), "utf8");
  for (const forbidden of ["DROP TABLE", "DELETE FROM", "UPDATE "]) {
    expect(!source.includes(forbidden), `migration ${file} must not contain ${forbidden.trim()}`);
  }
}

for (const entry of manifestEntries) {
  const expectedId = entry.filename.slice(0, 4);
  expect(entry.id === expectedId, `manifest id ${entry.id} does not match filename ${entry.filename}`);
  expect(files.includes(entry.filename), `manifest references missing migration file: ${entry.filename}`);
  expect(/^[a-f0-9]{64}$/.test(entry.checksumSha256), `manifest checksum is invalid: ${entry.filename}`);

  if (files.includes(entry.filename)) {
    const source = readFileSync(path.join(migrationDir, entry.filename));
    const actualChecksum = createHash("sha256").update(source).digest("hex");
    expect(
      entry.checksumSha256 === actualChecksum,
      `manifest checksum does not match SQL bytes: ${entry.filename}`
    );
  }
}

const firstMigration = read("src/core/storage/migrations/0001_alpha_storage_subset.sql");
const allMigrations = files.map((file) => read(`src/core/storage/migrations/${file}`)).join("\n");
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

expect(
  (firstMigration.match(/CREATE INDEX IF NOT EXISTS/g) ?? []).length >= 5,
  "first migration should define basic lookup indexes"
);

expect(
  allMigrations.includes("CREATE TABLE IF NOT EXISTS fts_entries ("),
  "migrations must define canonical fts_entries metadata table"
);
expect(
  allMigrations.includes("CREATE VIRTUAL TABLE IF NOT EXISTS fts_entry_text USING fts5"),
  "migrations must define an FTS5 text table for lexical search"
);
expect(
  allMigrations.includes("CREATE TABLE IF NOT EXISTS compression_artifacts ("),
  "migrations must define canonical compression_artifacts table"
);
expect(
  allMigrations.includes("CREATE TABLE IF NOT EXISTS compression_inputs ("),
  "migrations must define canonical compression_inputs table"
);

for (const required of [
  "repo_id TEXT NOT NULL REFERENCES repos(repo_id)",
  "repo_snapshot_id TEXT NOT NULL REFERENCES repo_snapshots(snapshot_id)",
  "worktree_state_id TEXT NOT NULL REFERENCES worktree_states(worktree_state_id)",
  "head_commit_sha TEXT NOT NULL",
  "status TEXT NOT NULL CHECK",
  "dependency_manifest_hash TEXT NOT NULL",
  "item_kind TEXT NOT NULL CHECK",
  "item_ref TEXT NOT NULL",
  "item_hash TEXT NOT NULL",
  "branch_name TEXT NOT NULL",
  "commit_sha TEXT NOT NULL",
  "FOREIGN KEY (artifact_id, session_id) REFERENCES context_artifacts(artifact_id, session_id)",
  "CHECK (can_restore = 0 OR (restore_id IS NOT NULL AND restore_command IS NOT NULL))",
  "send_count INTEGER NOT NULL CHECK",
  "token_count INTEGER NOT NULL CHECK",
  "CHECK (last_diff_state IN",
  "CHECK (diff_state IN",
  "CHECK (verification_status IN",
  "CHECK (privacy_status IN"
]) {
  expect(firstMigration.includes(required), `first migration is missing required schema guard: ${required}`);
}

if (errors.length > 0) {
  console.error("storage migration checks failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("storage migrations ok");
