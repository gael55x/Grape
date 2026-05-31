# Changelog

All notable user-facing changes to Grape will be documented here.

This file tracks released package behavior. V1 implementation-internal changes belong in `docs/v1/planning/changelog.md`. Spec-only changes belong in `docs/v1/planning/spec-changelog.md`.

## Unreleased

## 0.1.0-alpha.3 - 2026-05-31

### Added

- Added a purpose-built session reset benchmark fixture proving `resetSession: true` / `--reset-session` emits `INVALIDATE_PREVIOUS`, forces a current resend, and avoids reset-turn omission.
- Added restore-path protocol golden coverage for `RESTORE_AVAILABLE` restore IDs, session binding, restored body shape, and MCP output without absolute root paths.
- Added dedicated task/session mismatch exit classification through CLI exit code `6`.
- Added architecture standards for functional core / imperative shell, purposeful same-shape transforms, boundary error classification, clear naming, and avoiding nested policy conditionals.

### Changed

- Refreshed the README around the product promise: install Grape, keep using the coding agent normally, and let Grape track seen context, send safe deltas, invalidate stale context, resend pinned safety context, and restore omissions in the background.
- Split storage repository ownership into table-family directories for project setup, sessions, context artifacts, context ledgers, evidence, claims, proofs, compression, and indexing while preserving the public storage barrel and aggregate factory.
- Aligned package metadata for the `0.1.0-alpha.3` hardening candidate.
- Cleaned `dist/` before package builds and added package checks to block stale compiled files after source moves.

## 0.1.0-alpha.2 - 2026-05-30

### Changed

- Documented Node.js **22.13+** as the supported runtime (`node:sqlite` without `--experimental-sqlite`).
- CI and install smoke use Node 22.13+; spawned `grape` inherits `NODE_OPTIONS=--experimental-sqlite` on Node 22.5–22.12 when needed.

## 0.1.0-alpha.1 - 2026-05-30

### Fixed

- `grape` npm bin entry now runs when installed via `node_modules/.bin` symlinks (macOS `/private` path normalization).

### Added

- `npm run install:check` packs the tarball, installs it in a temp git repo, and smoke-tests `grape help`, `init`, and two-turn `compile`.
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
- Added lightweight file/symbol relationship indexing for allowed snapshot files during local bootstrap.
- Added a repository-derived context artifact compiler foundation from persisted snapshot, source, and relationship-index inputs.
- Added `grape compile --task <text>` to auto-bootstrap, compile, diff, persist, and write inspectable local context artifact files.
- Added the first MCP stdio server with `grape_get_context` and `grape_get_status` backed by the local compile/status app services, session-scoped context identity, `--repo` launch support, and explicit partial/unsafe handling for unsupported or risky context requests.
- Added omitted-context restore lookup through `grape omitted --session <id> --token <restoreToken>` and MCP `grape_get_omitted_item`, with stale-dependency rejection before omitted context is returned.
- Added artifact inspection through `grape artifacts`, `grape artifacts --artifact <id>`, and MCP `grape_get_artifact`.
- Added branch-switch invalidation for explicit session reuse in CLI and MCP context compilation, returning `INVALIDATE_PREVIOUS` for stale previous-branch context.
- Added bounded exact-source evidence sections with deterministic proof refs to repository-derived scaffold context artifacts.
- Added session reset recovery through CLI `--reset-session` and MCP `resetSession: true`, returning `INVALIDATE_PREVIOUS` and forcing full current resend for reused sessions.
- Added pinned active project rules from trusted rule files to repository-derived scaffold context artifacts.
- Added safe FTS5 lexical index persistence for allowed source records as an indexing foundation.
- Updated public context pack items returned by CLI, artifact JSON, and MCP to use the V1 `ContextPackItem` output shape.
- Added task source retrieval for scaffold context compilation, using safe FTS rows, symbol/path matches, and MCP seed refs to prioritize exact source evidence.
- Added conservative token-budget evaluation for CLI `--token-budget` and MCP `tokenBudget`, including unsafe output when required context cannot fit.
- Added public V1 `ContextArtifact` JSON projection for compile artifacts while keeping scaffold restore data in an internal sidecar.
- Added validated exact source proof-row persistence during local compile, while keeping durable claim promotion deferred.
- Added proof-row inspection through CLI `grape proofs` and MCP `grape_get_proofs`.
- Hardened omitted-context restore so stale proof dependencies reject restore tokens before content is returned.
- Added high-risk exact-context gating so risk overlays only compile safely when task-selected proof-backed exact evidence exists.
- Added CLI `grape claims --active` and MCP `grape_get_claims` for current-valid narrow source-excerpt claim inspection.
- Compiled current-valid narrow source-excerpt claims into context artifacts with claim/proof dependencies.
- Added deterministic `symbol_outline`, `rule_digest`, and cached `context_pack_summary` compression records with non-proof artifact orientation boundaries.
- Added `grape sessions` for session/diff ledger inspection.
- Added `grape stale` for CLI inspection of emitted stale-context invalidations without returning context bodies.
- Added MCP `grape_get_stale_items` for stale invalidation inspection without returning context bodies or absolute root paths.
- Added MCP `grape_get_rules` for current Git-visible, hash-verified, secret-scanned rule excerpt inspection without absolute root paths.
- Added MCP `grape_record_command_result` and `grape_record_test_result` for temporary agent-reported evidence without raw command/output persistence or durable claim promotion.
- Completed the restricted MCP write surface with `grape_record_candidate`, `grape_record_user_decision`, and `grape_request_user_confirmation`, all non-promoting and hash/redaction bounded.
- Added conflict inspection through CLI `grape conflicts` and MCP `grape_get_conflicts` over recorded claim conflict edges.
- Added recovery guidance to status, doctor, unsafe compile, lock-conflict, stale, and privacy/redaction failure paths.
- Added safe partial-bootstrap repair for malformed local `.grape/config.json`: status/doctor explain the issue, and init/compile back up the invalid config before writing a fresh one.
- Added `grape bench --fixture <name>` for scripted fixture token-reduction benchmarking over the real local compile/diff path.
- Hardened context-pack Markdown artifacts with artifact summary, diff counts, pack item input refs, omitted/restore metadata, artifact section summaries, dependency details, token/budget status, and warnings/safety fields.
- Added bootstrap project detection to `grape init --connect` for language/framework, package manager, scripts, test command, entry points, config files, confidence levels, and non-durable candidate rules.
- Added setup/status scan diagnostics and scanner rejection gates for oversized and binary files before source evidence ingestion.
- Hardened indexing path handling with Windows-style separator normalization and unsafe repo path rejection before file reads.
- Source evidence now distinguishes committed, staged, unstaged, and untracked Git scopes from porcelain status.
- Added `grape sync` and `grape diff-context --task <text>` as CLI fallback commands for refreshing local inputs and explicitly requesting a session-diffed context pack.
- Added `grape doctor --privacy` for privacy-focused local diagnostics without returning file bodies or secret values.
- Added token-budget pruning for `grape compile --token-budget` and MCP `tokenBudget`: required context is protected, optional context can be pruned, and budget omissions are recorded in the artifact.
- Scoped exact-source evidence and rendered current-valid claims to task-selected files when retrieval has concrete matches, reducing unrelated proof-backed context in task artifacts while keeping broad claim inspection commands available.
- Added multi-window exact source excerpts so distant task-selected symbol anchors in one source can produce separate proof-backed context windows.
- Filtered prior sent rows through current dependency staleness before rendering `context_pack_summary`, preventing compression orientation from mentioning context invalidated by the same compile.
- Added safe local database repair for bootstrap-capable flows. `init`, `sync`, and `compile` now back up unusable `.grape/grape.db` files before recreating local state, while `status` and `doctor` diagnose the state without mutating it.

### Changed

- Simplified the root README navigation/status area, replaced the agent-rules link with contributing guidance, and rewrote the root roadmap around practical now/next/later work.
