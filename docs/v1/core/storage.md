# V1 Storage

## Purpose

Define SQLite storage ownership, schema documentation, migrations, and concurrency rules.

## Source Of Truth

Storage follows the SQLite/WAL/FTS5 contract in `docs/v1/SPEC.md`.

## Update Triggers

- schema changes
- repository API changes
- migration behavior changes
- concurrency or lock behavior changes

## Agent Checks

Before editing storage behavior, agents must verify:

- no direct SQLite access outside storage repositories
- schema changes include migrations and tests
- storage does not contain business logic
- secret/redacted fields are handled correctly

## Minimum Tables

The V1 schema must define at least these tables or explicitly defer a table with an ADR. Table names follow `docs/v1/SPEC.md` where the canonical spec defines them. Supporting V1 tables are marked as additions.

| Table | Owner | Purpose |
|---|---|---|
| `schema_migrations` | storage | applied migration ID, checksum, timestamp |
| `projects` | storage/app | local Grape project identity |
| `repos` | git/storage | repo root, VCS identity, normalized path |
| `repo_snapshots` | git/storage | branch, commit, worktree hash, snapshot hash |
| `worktree_states` | git/storage | clean/dirty/unknown state and dirty file hashes |
| `sources` | evidence | source records, source type, source hash, privacy status |
| `source_rejections` | evidence/security | rejected ignored/private/secret/unsupported sources |
| `claims` | claims/trust | durable claims and verification status |
| `claim_candidates` | claims/trust | non-durable candidate claims |
| `proofs` | proofs/trust | proof refs, source hashes, excerpt hashes, support status |
| `claim_edges` | claims/trust | supersedes, contradicts, depends_on relationships |
| `project_rules` | evidence/trust | project rules and pinned safety invariants |
| `symbol_nodes` | indexing | symbol/file index metadata |
| `symbol_edges` | indexing | symbol relationship metadata |
| `fts_entries` | indexing | FTS5 searchable text refs, never raw secrets |
| `context_sessions` | sessions | session identity, agent ID, current lock status |
| `session_events` | sessions | reset, invalidation, lock conflict, branch switch events |
| `context_artifacts` | compiler | artifact metadata and hashes |
| `context_dependencies` | compiler | dependency manifest rows |
| `compression_artifacts` | compression | deterministic cache records and input hashes |
| `compression_inputs` | compression | compression artifact dependency hashes |
| `context_sent_items` | diff/sessions | session-scoped sent ledger |
| `omitted_context_items` | diff/sessions | restore metadata and omission reasons |
| `context_pack_items` | diff | emitted structured pack items |
| `sync_runs` | app/state | repo sync attempts and outcomes |
| `command_runs` | evidence | Grape-observed command runs |
| `test_runs` | evidence | Grape-observed test runs |
| `audit_events` | security/app | privacy approvals, blocked reads, redactions |

## Alpha Product Slice Storage Subset

Do not implement the full table set as the next storage step. The first persisted product slice should start with only the tables needed to prove safe session-scoped omission:

- `schema_migrations`
- `projects`
- `repos`
- `repo_snapshots`
- `worktree_states`
- `sources`
- `source_rejections`
- `claims`
- `claim_candidates`
- `proofs`
- `claim_edges`
- `project_rules`
- `context_sessions`
- `session_events`
- `context_artifacts`
- `context_dependencies`
- `context_sent_items`
- `omitted_context_items`
- `context_pack_items`
- `audit_events`

Tables outside this subset stay documented for V1, but they require explicit implementation need before code is added.

## Repository Boundary

- Every table must have an owning repository module.
- No code outside `src/core/storage/` may execute raw SQL.
- Repositories return typed domain records, not loosely shaped row objects.
- Application services own transaction boundaries for multi-repository state changes.
- Storage repositories do not decide trust, relevance, compression policy, or redaction policy.

## SQLite Policy

- Use SQLite in WAL mode.
- Set an explicit busy timeout.
- Keep write transactions short.
- Use one writer transaction for each explicit state transition that persists multiple records.
- Session locks must be represented durably, not only in process memory.
- FTS5 is allowed for lexical search, but FTS entries must reference source IDs and must not contain raw secrets.
- Safety-critical serialized enums must use database `CHECK` constraints, including diff state, task type, verification status, privacy status, source type, lock status, and session status.
- `context_sessions` must persist repo, snapshot, worktree, branch, head commit, task, status, and lock identity so branch/session invalidation can fail closed.
- `context_sent_items` and `omitted_context_items` must persist item kind/ref/hash, branch/commit identity, dependency manifest hash where applicable, token counts, restore metadata, and send counts so omission and restore decisions are auditable.

The default connection policy is encoded in `src/core/storage/sqlite-policy.ts` and covered by behavioral tests. Runtime migration application uses Node's built-in `node:sqlite` through `src/core/storage/sqlite-runtime.ts`, so V1 currently requires Node 22 or newer and avoids a native SQLite package dependency. Driver-specific code must apply the pragma statements before running migrations or repository writes.

## Migration Rules

- Migration filenames use `NNNN_short_description.sql`.
- Migrations are append-only after merge.
- Every schema change updates this file, `../planning/spec-changelog.md`, and migration tests.
- Every migration stores checksum and applied timestamp in `schema_migrations`.
- Committed migration references must include the SHA-256 checksum of the SQL file bytes.
- Destructive migrations require an ADR before implementation.
- `npm run storage:check` validates migration naming, manifest coverage, the first alpha table set, canonical table names, and obviously unsafe migration statements.
- Migration planning must reject duplicate IDs, out-of-order available migrations, unknown applied migrations, changed filenames, and changed checksums before any SQL is applied.
- Applied migrations must form a prefix of available migrations. Sparse histories fail closed.
- Runtime SQLite apply tests must cover empty-database migration, idempotent re-run, WAL/foreign-key pragmas, and checksum drift before SQL execution.

## Path And Hash Rules

- Store normalized repo-relative paths where possible.
- Store absolute paths only when needed for local project identity.
- Normalize separators to `/` in persisted repo-relative paths.
- Preserve case in stored paths. Case-fold only for comparison on case-insensitive filesystems.
- Hash file content with SHA-256.
- Hash redacted excerpts separately from source content; never use a redacted excerpt hash as proof that the original source is unchanged.

## Required Tests

- `migration_applies_from_empty_database`
- `migration_checksums_are_recorded`
- `direct_sql_outside_storage_is_forbidden`
- `wal_mode_and_busy_timeout_configured`
- `session_lock_survives_process_boundary`
- `path_normalization_handles_windows_separators`
- `fts_entries_do_not_store_raw_secrets`
