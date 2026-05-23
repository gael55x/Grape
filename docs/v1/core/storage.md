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

The V1 schema must define at least these tables or explicitly defer a table with an ADR:

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
| `rules` | evidence/trust | project rules and pinned safety invariants |
| `symbols` | indexing | symbol/file index metadata |
| `fts_entries` | indexing | FTS5 searchable text refs, never raw secrets |
| `sessions` | sessions | session identity, agent ID, current lock status |
| `session_events` | sessions | reset, invalidation, lock conflict, branch switch events |
| `artifacts` | compiler | artifact metadata and hashes |
| `artifact_dependencies` | compiler | dependency manifest rows |
| `compression_artifacts` | compression | deterministic cache records and input hashes |
| `sent_items` | diff/sessions | session-scoped sent ledger |
| `omitted_items` | diff/sessions | restore metadata and omission reasons |
| `context_pack_items` | diff | emitted structured pack items |
| `sync_runs` | app/state | repo sync attempts and outcomes |
| `command_runs` | evidence | Grape-observed command runs |
| `test_runs` | evidence | Grape-observed test runs |
| `audit_events` | security/app | privacy approvals, blocked reads, redactions |

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

## Migration Rules

- Migration filenames use `NNNN_short_description.sql`.
- Migrations are append-only after merge.
- Every schema change updates this file, `../planning/spec-changelog.md`, and migration tests.
- Every migration stores checksum and applied timestamp in `schema_migrations`.
- Destructive migrations require an ADR before implementation.

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
