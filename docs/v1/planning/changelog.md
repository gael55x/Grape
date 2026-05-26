# V1 Changelog

This file tracks implementation-facing V1 changes.

User-facing release notes belong in the root `CHANGELOG.md`. Spec-contract changes belong in `spec-changelog.md`.

## Unreleased

### Added

- Initial V1 documentation architecture.
- Committed canonical V1 implementation contract at `docs/v1/SPEC.md`.
- Implementation planning now uses goal names: Documentation Foundation, In-Memory Context Loop, and Alpha Product Slice.
- Expanded implementation contracts for architecture, state machine, trust, artifact, diff, compression, MCP, CLI, storage, testing, benchmarks, security, fixtures, examples, and invariants.
- Organized V1 supporting docs into purpose-based folders under `architecture/`, `core/`, `contracts/`, `interfaces/`, `quality/`, and `planning/`.
- Added In-Memory Context Loop plan with scoped work tickets and exit criteria.
- Added minimal project skeleton with package metadata, TypeScript config, docs structure guard, and shared canonical contract types.
- Added `clean-typescript-app` fixture with metadata hash validation.
- Added shared contract and state-machine skeleton validation scripts.
- Added repo snapshot shape and clean fixture snapshot smoke check.
- Added evidence, proof, and durable claim shapes with trust-shape validation.
- Added current-valid filtering skeleton and consolidated In-Memory Context Loop smoke checks.
- Tightened repo snapshot and current-valid shapes to reject placeholder hashes and missing proofs.
- Added context artifact builder skeleton with manifest, section hash, dependency-ref, exact-context, and blocked-redaction guards.
- Added in-memory context diff proof for safe omission, restore metadata, pinned resend, and unsafe omission counting.
- Added in-memory token accounting for naive resend cost, Grape pack cost, omitted unchanged tokens, pinned overhead, invalidation overhead, unsafe omissions, stale sends, and reduction percent.
- Added TypeScript typechecking and Node behavioral tests for the in-memory diff/token path.
- Added a zero-dependency architecture-boundary check for TypeScript import direction.
- Added empty source ownership modules for the documented app, adapter, storage, security, session, scope, compression, indexing, and claims layers.
- Marked SQLite Schema And Migrations as the next goal and deferred CI wiring until the dependency and lockfile baseline is defined.
- Added the first alpha storage migration contract and a zero-dependency migration validator.
- Added typed SQLite connection policy defaults for WAL, foreign keys, busy timeout, synchronous mode, and temp store.
- Added pure storage migration planning for pending migrations, checksum drift, filename drift, unknown applied migrations, and ordering failures.
- Hardened migration planning for sparse histories, real SQL checksums, schema guards, session ledger identity, restore metadata, and stricter architecture import boundaries.
- Added a pinned TypeScript dev dependency, `package-lock.json`, contributor `npm ci` guidance, and minimal GitHub Actions CI for `npm run check`.
- Added Node 22.5+ `node:sqlite` runtime migration application tests for empty DB migration, idempotent re-run, WAL/foreign-key pragmas, and checksum drift before SQL execution.
- Added the first typed SQLite repository slice for project/repo/snapshot/worktree setup, context sessions, context artifacts, dependencies, sent items, and omitted items.
- Added ADR-0004 to make Node 22.5+ the explicit V1 runtime for the built-in SQLite path.
- Hardened storage repositories with same-session artifact ledger constraints, restorable omission constraints, repository-applied SQLite pragmas, compare-and-set session locks, session events, context pack item persistence, and transaction rollback support.
- Added a durable context build service that persists an already-built artifact, dependencies, context pack items, sent ledger rows, omitted ledger rows, invalidations, and token metrics inside one transaction.
- Split durable context build record mapping away from orchestration to keep the app service modular.
- Added code modularity standards and split triggers for future contributors and agents.
- Added a Git-backed repo snapshot service that reads branch, commit, dirty paths, Git-visible file hashes, ignored-file exclusions, source-kind classification, and deterministic snapshot/worktree hashes.
- Added a narrow app service that persists Git repo snapshots, project/repo identity, and worktree state through storage repositories in one transaction.
- Added the first CLI setup/bootstrap slice with `grape init --connect`, `grape help`, `grape status`, `grape doctor`, and `grape mcp --print-config`.
- Added modular local-project app services for `.grape/` layout/config, local migration-backed storage, Git exclusion, initialization, status, doctor diagnostics, and MCP connection guidance.
- Added a conservative local privacy ignore policy for repo snapshots so `.ignore`, `.cursorignore`, `.aiignore`, `.grapeignore`, and Git ignored paths are filtered before file bytes are read.
- Added the V1 implementation status matrix at `docs/v1/planning/implementation-status.md`.
- Added dedicated evidence storage repositories and snapshot source ingestion so setup/snapshot persistence stores allowed source records plus privacy-safe ignored/private source rejections.
- Added the first persisted file-indexing foundation with module/symbol nodes and `contains`/`imports` edges for allowed snapshot files.
- Added a repository-derived artifact compiler foundation that builds deterministic in-memory context artifacts from persisted snapshots, source evidence, and file relationship indexes.
- Added `grape compile --task <text>` as a CLI fallback path that auto-bootstraps local state, compiles a repository-derived context pack, persists session diff rows, writes scaffold JSON/Markdown artifacts, and applies a basic artifact secret scan.
- Added the first stdio MCP adapter with framed JSON-RPC handling, `tools/list`, `grape_get_context`, and `grape_get_status`, reusing local-project app services instead of duplicating compile/status logic. The adapter requires session identity for context diffing, supports `--repo` launch, returns repo-relative artifact refs, applies seed refs to risk detection, marks unsupported seed/budget narrowing as partial risk, and rejects oversized frames.
- Added CLI and MCP omitted-context restore lookup: `grape omitted --session <id>` lists omitted rows, `grape omitted --session <id> --token <restoreToken>` restores current omitted sections, and `grape_get_omitted_item` exposes the same restore path over stdio while rejecting stale dependencies and tampered/redaction-blocked artifact output.
- Added CLI and MCP artifact inspection: `grape artifacts`, `grape artifacts --artifact <id>`, and `grape_get_artifact` expose stored scaffold artifact metadata, dependency rows, warnings, unsafe reasons, and repo-relative file refs without claiming final V1 artifact schema support.
- Added branch-switch invalidation for explicit session reuse: CLI and MCP context compilation now update session compile state under lock, record `branch_changed` session invalidation events, and emit `INVALIDATE_PREVIOUS` instead of omitting previous-branch context.
- Added bounded exact-source evidence to repository-derived scaffold artifacts. Selected allowed source records are reread only after path safety checks, source-hash verification, binary-content skipping, excerpt bounding, and deterministic proof-ref/excerpt-hash generation.
