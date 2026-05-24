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
