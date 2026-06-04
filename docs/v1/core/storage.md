# V1 Storage

## Purpose

Define SQLite storage ownership, schema documentation, migrations, and concurrency rules.

## Source Of Truth

Storage follows the SQLite/WAL/local lexical index contract in `docs/v1/SPEC.md`.

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
| `fts_entries` | indexing | lexical searchable text refs, never raw secrets |
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

## Indexing Foundation Storage Extension

Migration `0002_indexing_foundation.sql` implements the first indexing-specific tables after source ingestion made file relationship tracking possible:

- `symbol_nodes` stores module/file nodes and detected symbols for allowed snapshot files, with a non-null `source_id` anchor to the source evidence row.
- `symbol_edges` stores `contains` and import-resolution relationship edges between indexed nodes or unresolved import refs.

This is intentionally a foundation, not a complete code intelligence graph. The current extractor is deterministic and AST-backed for TypeScript/JavaScript modules, symbols, exports, imports, methods, and direct call expressions, with regex fallback only for unsupported inputs. It records confidence and discovery method so downstream compiler logic cannot mistake the index for proof or complete semantic coverage.

Future broad language support must not add parser-specific assumptions directly to storage repositories or retrieval policy. Language and framework providers should emit the same normalized `symbol_nodes` / `symbol_edges` vocabulary plus provider capability metadata in record metadata until a dedicated capability table is justified. Unsupported languages must continue to persist safe module/file nodes and lexical rows where source text is allowed, and must surface provider gaps as compiler/retrieval warnings rather than as missing silent context.

Monorepo support should keep package/workspace boundaries in dependency metadata before adding new schema. Package-local manifests, lockfiles, and workspace roots should be recorded as dependency refs for selected package context so package-scoped changes can invalidate narrowly. A schema migration for first-class package/workspace tables is allowed only when tests prove metadata-only scoping is insufficient.

Migration `0003_fts_entries.sql` adds the first portable lexical index foundation:

- `fts_entries` stores source-linked lexical entry metadata, hashes, and repo/snapshot refs.
- `fts_entry_text` stores allowed source text rows in a normal SQLite table so bootstrap does not depend on SQLite FTS5 extension support.

Lexical persistence reads only existing allowed source records, reuses the same path/hash/binary/symlink guards as file indexing, skips secret-looking text before inserting search rows, and stores search results through repository methods rather than direct SQL outside storage. The local compile service now uses these rows, explicit seed file refs, path-like test seed refs, import-related test refs, and symbol/path matches to prioritize scaffold source evidence and to satisfy the first high-risk exact-context policy only when a proof-backed exact excerpt is selected for the task. This is still a source-selection foundation only; durable current-valid claim retrieval remains pending.

Migration `0004_compression_cache.sql` adds the first deterministic compression cache tables:

- `compression_artifacts` stores cache metadata for V1 deterministic `symbol_outline`, `rule_digest`, and `context_pack_summary` records.
- `compression_inputs` stores each input ref and input hash used to derive a compression artifact.

The current implementation writes `symbol_outline` records from the deterministic symbol index, `rule_digest` records from verified active rule excerpt proofs, and `context_pack_summary` records from the session-scoped sent ledger after durable pack persistence. Compression repositories persist derived cache records only; they do not decide compiler policy, trust, proof validity, or whether a summary can replace context.

Migration `0005_context_performance_indexes.sql` adds performance indexes only:

- `context_pack_items(session_id, diff_state, invalidates_sent_item_id)` supports invalidation-ref queries without loading every pack row.
- `context_pack_items(session_id, diff_state, created_at, pack_item_id)` supports sent-payload lookup for dependency staleness checks.
- `context_sent_items(session_id, branch_name, commit_sha, item_kind, section_id, last_sent_at)` supports active/current sent-ledger queries for context-pack summaries.
- `fts_entries(snapshot_id, source_ref, fts_entry_id)` supports bounded lexical lookup ordering.

These indexes do not change persisted data shape or safety policy. App services still decide staleness, omission, restore, and invalidation behavior.

Local snapshot persistence may reuse an already-captured `RepoSnapshot` from the caller instead of running Git/file hashing twice. When the same immutable snapshot row already exists, evidence and index materialization may be skipped only after storage proves the expected source/rejection rows and expected index families are present. Missing evidence or index rows force a rebuild instead of assuming the snapshot is complete.

MCP restricted writes currently reuse existing V1 tables instead of adding premature write-specific migrations. Command/test observation writes use `sources` with `source_type = 'command_run'` or `source_type = 'test_run'`, `trust_class = 'temporary'`, and `redaction_status = 'redacted'`. The local CLI observed runner also reuses `sources` for Grape-observed command/test rows, but writes them with `trust_class = 'trusted'`, `redaction_status = 'redacted'`, `observedBy = 'grape'`, `observedByGrape = true`, and a Grape-created `observedRunId` in metadata. In the same application-owned transaction it can also write a direct `proofs` row with `proof_type = 'grape_observed_run_result'`, a `claim_candidates` row, a verified `claims` row with `claim_type = 'grape_observed_run_result'`, and a proof-to-claim link. For this proof type, `excerpt_hash` stores the deterministic observed-run result hash because the existing proof table has not yet split excerpt hashes from other proof support hashes. Candidate writes create a temporary `assistant_response` source when needed and link it to `claim_candidates` with `rejection_reason = 'mcp_candidate_requires_proof'`. User decisions use `sources` with `source_type = 'user_message'`, `trust_class = 'temporary'`, and `redaction_status = 'redacted'`. Raw command, stdout, stderr, prompt, response, and candidate evidence bodies are not stored in source metadata; only hashes and scoped metadata are persisted.

## Repository Boundary

- Every table must have an owning repository module.
- No code outside `src/core/storage/` may execute raw SQL.
- Repositories return typed domain records, not loosely shaped row objects.
- Application services own transaction boundaries for multi-repository state changes.
- `runStorageTransaction` is the storage helper for one explicit writer transaction; app services decide the state transition, storage only guarantees commit/rollback.
- Storage repositories do not decide trust, relevance, compression policy, or redaction policy.
- `src/core/storage/repositories.ts` owns shared storage record types and the public aggregate `createStorageRepositories` factory only.
- Project/repo/snapshot/worktree setup storage lives in `src/core/storage/project/repositories.ts`.
- Context session and session-event storage lives in `src/core/storage/session/repositories.ts`.
- Context artifact and dependency storage lives in `src/core/storage/context-artifact/repositories.ts`.
- Sent, omitted, and context-pack ledger storage lives in `src/core/storage/context-ledger/repositories.ts`.
- Evidence source storage is split into `src/core/storage/evidence/repositories.ts` so source/source-rejection persistence does not expand the session-ledger repository file.
- Evidence repositories persist already-classified records from `src/core/evidence/`; they do not decide trust, privacy policy, source relevance, or proof validity.
- Claim storage is split into `src/core/storage/claims/repositories.ts` so claim candidates and durable claims do not expand session-ledger or proof repositories.
- Claim repositories persist already-gated candidate/claim records and claim edge records only; extraction, belief gates, scope policy, contradiction detection, and current-valid filtering stay in claims/trust/retrieval/app modules.
- Proof storage is split into `src/core/storage/proofs/repositories.ts` so validated proof rows are persisted without expanding session-ledger or evidence repositories.
- Proof repositories persist already-validated proof records only and can link a proof row to an accepted claim. Validation stays in `src/core/proofs/`; claim gating stays out of storage.
- Initial source storage keeps branch, commit, repo ID, project ID, worktree hash, and worktree state ID inside `metadata_json` until a later migration promotes first-class `Source` shape fields that the compiler and MCP surface will query directly.
- Indexing storage is split under `src/core/storage/indexing/`: `repositories.ts` owns aggregate symbol repository wiring, `fts-repositories.ts` owns lexical rows/search, and symbol repository methods own `symbol_nodes` and `symbol_edges` SQL and typed row mapping. The `fts` file/table names are retained for compatibility with earlier local databases.
- Compression cache storage is split into `src/core/storage/compression/repositories.ts` so deterministic cache metadata and input hashes do not expand the session-ledger repository file.
- Repository tests must prove session-scoped sent/omitted ledgers and fail-closed foreign-key behavior before app services rely on those tables.

## SQLite Policy

- Use SQLite in WAL mode.
- Set an explicit busy timeout.
- Keep write transactions short.
- Use one writer transaction for each explicit state transition that persists multiple records.
- Session locks must be represented durably, not only in process memory.
- Session locks must use atomic compare/update methods for acquire, renew, release, and expiry; direct lock-column mutation outside the session repository is forbidden.
- Lexical search entries must reference source IDs and must not contain raw secrets. SQLite FTS5 extension support is not required for V1 bootstrap.
- Safety-critical serialized enums must use database `CHECK` constraints, including diff state, task type, verification status, privacy status, source type, lock status, and session status.
- `context_sessions` must persist repo, snapshot, worktree, branch, head commit, task, status, and lock identity so branch/session invalidation can fail closed.
- `context_sent_items` and `omitted_context_items` must persist item kind/ref/hash, branch/commit identity, dependency manifest hash where applicable, token counts, restore metadata, and send counts so omission and restore decisions are auditable.
- Sent, omitted, and pack rows must reference an artifact owned by the same session; cross-session artifact references fail closed.
- Restorable omitted rows must include a restore ID and restore command.
- Explicit session resets are recorded as `session_events` rows with `reason = "session_reset"`; resent `context_sent_items` rows include `session_reset_id` so reset-driven full resend is auditable.
- Existing `context_sessions` rows may update their compile state only through the session repository, after the durable build has acquired or renewed the session lock. The update is limited to snapshot/worktree/branch/base/head/status timestamps and must not silently change lock ownership.
- Branch switches are recorded in `session_events` as `eventType: "session_invalidated"` with `reason: "branch_changed"` so branch-scoped sent context invalidation is auditable.
- Repository construction must apply the SQLite connection policy so foreign keys are not optional caller discipline.
- Durable context builds must persist artifact, dependency, pack, sent, and omitted rows in one transaction owned by `src/app/`.
- Local artifact file materialization uses temp-file then rename writes so partial local files are not exposed when materialization fails. The writes currently remain coupled to the durable send transaction so Grape does not mark context as sent before local output has passed render/secret-scan/materialization.

The default connection policy is encoded in `src/core/storage/sqlite-policy.ts` and covered by behavioral tests. Runtime migration application uses Node's built-in `node:sqlite` through `src/core/storage/sqlite-runtime.ts`, avoiding a native SQLite package dependency. The published alpha package requires Node.js 22.13 or newer so `node:sqlite` is available without `--experimental-sqlite`; Node 22.5-22.12 remains a historical implementation decision, not the supported package runtime floor. Storage factories must apply the pragma statements before running migrations or repository writes. Packaged builds copy SQL migrations into `dist/core/storage/migrations/`; the local storage bootstrap resolves that directory from compiled code so global installs do not need TypeScript source files at runtime.

Local bootstrap-capable flows (`init`, `sync`, and `compile`) may repair an unusable `.grape/grape.db` only after preserving the old file. Repairable database failures are limited to SQLite corruption/readability errors and non-empty local databases that lack trusted `schema_migrations` metadata. The repair path renames the old database to `.grape/grape.db.invalid.<timestamp>` and also preserves SQLite sidecars when present, then reruns migrations into a fresh local database. Read-only inspection flows such as `status` and `doctor` diagnose this state and provide recovery guidance instead of mutating local state.

## Migration Rules

- Migration filenames use `NNNN_short_description.sql`.
- Migrations are append-only after merge.
- Every schema change updates this file, `../planning/spec-changelog.md`, and migration tests.
- Every migration stores checksum and applied timestamp in `schema_migrations`.
- Committed migration references must include the SHA-256 checksum of the SQL file bytes.
- Destructive migrations require an ADR before implementation.
- `npm run storage:check` validates migration naming, manifest coverage, the initial table set, canonical table names, and obviously unsafe migration statements.
- Migration planning must reject duplicate IDs, out-of-order available migrations, unknown applied migrations, and changed checksums before any SQL is applied. Filename-only drift is tolerated when the migration ID and checksum still match so purpose-based migration renames do not break existing local projects.
- Applied migrations must form a prefix of available migrations. Sparse histories fail closed.
- Runtime SQLite apply tests must cover empty-database migration, idempotent re-run, WAL/foreign-key pragmas, and checksum drift before SQL execution.
- Runtime migration must reject a non-empty database that has no trusted `schema_migrations` table.

## Path And Hash Rules

- Store normalized repo-relative paths where possible.
- Store absolute paths only when needed for local project identity.
- Normalize separators to `/` in persisted repo-relative paths.
- Preserve case in stored paths. Case-fold only for comparison on case-insensitive filesystems.
- Hash file content with SHA-256.
- Hash redacted excerpts separately from source content; never use a redacted excerpt hash as proof that the original source is unchanged.
- Snapshot-derived `source_id` and `source_rejection_id` values are deterministic for the repo, snapshot, path, and relevant hash or rejection reason so repeated bootstrap/sync runs are idempotent.

## Required Tests

- `migration_applies_from_empty_database`
- `migration_checksums_are_recorded`
- `direct_sql_outside_storage_is_forbidden`
- `wal_mode_and_busy_timeout_configured`
- `session_lock_survives_process_boundary`
- `cross_session_artifact_ledger_rows_fail_closed`
- `restorable_omission_requires_restore_metadata`
- `repository_creation_applies_sqlite_pragmas`
- `non_empty_unmigrated_database_is_rejected`
- `storage_transaction_rolls_back_partial_state`
- `durable_context_build_persists_first_turn_pack`
- `durable_context_build_rolls_back_partial_state`
- `snapshot_evidence_persists_allowed_sources`
- `snapshot_evidence_persists_private_rejections_without_raw_content`
- `snapshot_evidence_persistence_is_idempotent`
- `snapshot_evidence_and_index_reuse_requires_existing_rows`
- `file_index_persists_module_nodes_and_import_edges`
- `file_index_excludes_private_sources`
- `file_index_skips_symlinks_without_reading_targets`
- `file_index_skips_hash_mismatches`
- `file_index_skips_binary_files`
- `file_index_persistence_is_idempotent`
- `file_index_rebuilds_missing_rows_for_existing_snapshot`
- `unsupported_language_gets_safe_lexical_fallback_with_warning`
- `polyglot_repo_reports_provider_capability_gaps`
- `monorepo_retrieval_preserves_package_boundaries`
- `package_manifest_change_invalidates_package_scoped_context`
- `path_normalization_handles_windows_separators`
- `fts_entries_do_not_store_raw_secrets`
- `validated_source_proof_rows_persist_idempotently`
- `invalid_source_proof_hash_is_rejected`
- `validated_source_claims_persist_after_proofs`
- `source_claim_candidate_rejected_without_proof`
- `compression_artifact_requires_input_hashes`
- `compression_dependency_is_in_artifact_manifest`
- `session_ledger_scoped_query_helpers_are_session_bound`
