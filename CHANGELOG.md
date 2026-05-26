# Changelog

All notable user-facing changes to Grape will be documented here.

This file tracks released package behavior. V1 implementation-internal changes belong in `docs/v1/planning/changelog.md`. Spec-only changes belong in `docs/v1/planning/spec-changelog.md`.

## Unreleased

### Added

- Initial public documentation architecture for V1 implementation preparation.
- Committed V1 implementation contract and Documentation Foundation standards.
- Organized V1 documentation into purpose-based folders while keeping `docs/v1/SPEC.md` canonical.
- Added initial project skeleton and shared V1 contract types.
- Added first In-Memory Context Loop fixture with metadata validation.
- Added validation scripts for shared contracts and state-machine skeleton.
- Added repo snapshot shape and alpha snapshot smoke check.
- Added evidence, proof, and durable claim interface baseline.
- Added current-valid filtering skeleton and consolidated In-Memory Context Loop smoke harness.
- Tightened In-Memory Context Loop snapshot and current-valid shapes.
- Added context artifact builder skeleton with dependency manifest and section safety guards.
- Added in-memory context diff proof for pinned resend, safe omission, restore metadata, and unsafe omission counting.
- Added in-memory token accounting baseline for naive resend versus Grape context pack cost.
- Added TypeScript typecheck and Node behavioral test gates.
- Added an architecture-boundary check for TypeScript import direction.
- Added empty source ownership modules for documented V1 layers.
- Marked SQLite Schema And Migrations as the next implementation goal.
- Added the first alpha storage migration contract and migration validator.
- Added typed SQLite connection policy defaults and behavioral coverage.
- Added pure storage migration planning with checksum and ordering safeguards.
- Hardened storage migration and session-ledger contracts for safe omission/invalidation work.
- Added pinned TypeScript dev dependency, lockfile, and CI check workflow.
- Added Node 22.5+ built-in SQLite migration runtime and behavior tests.
- Added first typed SQLite repository slice for persisted session-ledger work.
- Hardened persisted session-ledger storage so cross-session artifact references fail closed and restorable omissions require restore metadata.
- Added the first durable context build proof for persisted first-turn send, second-turn omission, stale manifest invalidation, and rollback behavior.
- Added the first local setup CLI slice with `grape init --connect`, `grape help`, `grape status`, `grape doctor`, and `grape mcp --print-config`.
- Added conservative local privacy ignore filtering for repo snapshots before file bytes are read.
- Added snapshot source evidence persistence for allowed repository files and privacy-safe ignored/private rejections during local bootstrap.
