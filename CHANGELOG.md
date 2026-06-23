# Changelog

All notable user-facing changes to Grape will be documented here.

This file tracks released package behavior. V1 implementation-internal changes belong in `docs/v1/planning/changelog.md`. Spec-only changes belong in `docs/v1/planning/spec-changelog.md`.

## Unreleased

### Added

- Added `grape mcp --install --client codex` for project-local Codex MCP config in `.codex/config.toml`.
- Added MCP `initialize` instructions so Codex-style clients receive Grape session, invalidation, and restore guidance from the server.
- Added `grape mcp --print-agents-snippet` to print path-neutral AGENTS.md guidance without editing files.
- Added a repo-local Codex plugin in `plugins/grape` with Grape MCP config, a Grape skill, and a marketplace entry in `.agents/plugins/marketplace.json`.
- Added `npm run codex:check` to verify Grape's local Codex setup without touching the normal Codex config.

### Fixed

### Changed

- Compacted compression dependency metadata in public context artifacts and MCP payloads. Detailed compression input refs and hashes remain in local storage for inspection.
- Added retention defaults to local `.grape/config.json`; older schema-1 configs without the field still read with the same defaults.
- Added `grape compact` for preview-first context artifact, compression cache, FTS, derived symbol metadata, orphan snapshot, and invalidated ledger retention cleanup. It requires `--confirm` before deleting eligible old artifact rows, regular artifact files, unreferenced compression cache rows, old searchable text rows, old symbol metadata rows, old orphan snapshot rows, or old closed invalidation pairs.
- `grape compact` now reports measured `.grape`, database, WAL, SHM, artifact JSON, artifact Markdown, and artifact repository bytes before and after cleanup.

## 1.0.0-beta.8 - 2026-06-17

### Added

- Added actual MCP client config auto-wiring for Cursor and Claude Desktop through `grape mcp --install --client cursor` and `grape mcp --install --client claude`, with `--dry-run` previews, `--force` conflict replacement for `mcpServers.grape` only, and manual `grape mcp --print-config` fallback for other clients.

### Fixed

- Fixed MCP stdio transport to use newline-delimited JSON-RPC messages instead of `Content-Length` header framing, restoring compatibility with real MCP clients such as Claude Code and Cursor.

### Changed

- Updated `grape init --connect` and `grape mcp --install` output so the MCP-first setup path points to explicit Cursor and Claude Desktop install commands, restart/reload guidance, connection verification, and the manual `grape mcp --print-config` fallback.
- Added continuity evidence to `grape sessions`, including active sent ledger counts, omitted/restorable item counts, omitted token counts, and stale invalidation counts.
- Expanded the packaged beta client trial to cover installed CLI core workflows plus MCP session workflows, and added cross-platform CI coverage for Ubuntu, macOS, and Windows.
- Simplified MCP setup docs with a clearer integration path, session rules, stdio transport notes, and troubleshooting checks.
- Clarified that the 1.0.0-beta.7 stdio framing fix made MCP connect correctly but did not write Cursor or Claude Desktop config files.
- Clarified product framing around read amplification, context continuity, and stale-context guardrails so Grape is not presented as another repo reader.

## 1.0.0-beta.6 - 2026-06-17

### Added

- Added `grape --version` and `grape version` for install verification.
- Added command-specific `--help` output for public CLI commands.

### Fixed

- Improved first-run errors for non-Git directories and empty Git repositories.
- Fixed privacy doctor output so normal diagnostic wording is not redacted as a secret.
- Added next-step guidance to empty inspection command output.

### Changed

- Clarified install verification, MCP setup, second-turn context behavior, local `.grape/` storage, and Graphify comparator scope in public docs.
- Made package checks reject README links that would break in the npm package.

## 1.0.0-beta.3 - 2026-06-14

### Added

- Added `docs/v1/interfaces/getting-started.md` as the end-user onboarding guide for install, MCP setup, CLI fallback workflow, and common errors.
- Added README quick start, `@beta` install guidance, and expanded manual CLI command list.

### Fixed

- Improved CLI-first session errors and recovery guidance for `grape init`, `status`, `doctor`, `sync`, and `bench`.
- Humanized status warning output for stale invalidations and dirty worktree context.
- Clarified benchmark fixture, restore token, task mismatch, and missing `--task` argument errors.

### Changed

- Documented `grape diff-context --explain` in the CLI contract and added an MCP client configuration example to agent session docs.
- Reused `ensureConfiguredLocalProjectLayout` and shared `hashStableParts` to remove duplicated local project helper code.


### Added

- Added layered post-beta benchmark reporting for retrieval, evidence, project rules, pack `inputRefs`, and final agent-facing refs, with recorded `searchEngine` metadata (`rg` or `node-fallback`).

### Fixed

- Fixed task retrieval to exclude package paths named in `without pulling <path>` task phrases and to exclude `docs/v1/legacy` paths on post-beta documentation tasks unless the task explicitly names legacy or alpha content.
- Fixed source-manifest context pack items to attach dependency refs only for task-retrieval-selected sources, reducing known-irrelevant files in pack `inputRefs`.

### Changed

- Clarified post-beta benchmark docs and evidence boundaries. Local fixture JSON is directional evidence only, not an official release benchmark claim.

## 1.0.0-beta.0 - 2026-06-13

### Added

- Added `npm run beta:client-trial` as the automated packaged-install MCP client trial. It exercises `initialize`, `tools/list`, `grape_get_status`, two-turn `grape_get_context`, omission, restore, source invalidation, branch invalidation, reset, task/session mismatch recovery guidance, status redaction checks, and ignored secret-looking file rejection over stdio from a packed install.
- Added `npm run beta:check` as the extended local beta-readiness gate over `npm run check`, `npm run benchmark:run`, `npm run e2e:alpha`, and `npm run beta:client-trial`.
- Added `npm run global:smoke` for post-publish verification of the registry-installed global package.
- Added `grape run` and `grape test` for local Grape-observed command/test execution. The commands record trusted redacted `command_run` / `test_run` evidence with observed run IDs, command/output hashes, exit status, timestamps, and session scope without persisting raw command output.
- Added narrow `grape_observed_run_result` proof/claim promotion for local Grape-observed command/test runs. It proves only the observed run result, not product correctness or root cause.
- Added narrow provider-backed symbol declaration claims for high-confidence TypeScript/JavaScript declarations covered by accepted exact source excerpts. They prove declaration-span existence only, not imports, behavior, correctness, root cause, or complete architecture.
- Added narrow provider-backed package manifest dependency claims for trusted npm `package.json` dependency entries. They prove only that the current scoped manifest declares a dependency, render in matching task context with claim/proof refs, and do not expose raw manifest specifiers or claim installed/used/runtime-safe dependencies.
- Added related-test relationship details to task retrieval output so agents can see which import/call edge selected a test file without treating it as proof that tests ran, covered behavior, or proved correctness.
- Added stable relationship refs for related-test retrieval evidence when the selected import/call edge comes from the indexed symbol graph.
- Scoped observed test-run claims to explicit test file refs in selected-source artifacts so unrelated current-session test results stay inspectable without being rendered as task evidence.
- Added conservative project-rule conflict creation and manual CLI resolution. Parsed `project_rule` claims can now create `needs_review` conflict edges, `grape conflicts` shows open conflicts, and `grape conflicts --resolve <edge> --as coexists_with|variant_of` records a local resolution edge.
- Added the language-provider documentation boundary: Grape context is graph-shaped, TypeScript/JavaScript graph extraction is strongest today, and Kotlin/Java/Python/etc. must use safe exact/path/lexical fallback until providers and fixtures prove stronger support.

### Changed

- Refreshed user-facing docs for the `1.0.0-beta.0` npm prerelease: beta install path, honest transport scope, benchmark claim boundaries, and documentation style rules in `AGENTS.md`.
- CI `beta-smoke` now runs `npm run benchmark:run`, `npm run e2e:alpha`, and `npm run beta:client-trial` after the cross-platform `npm run check` matrix.
- Hardened packaged install smoke to prove CLI omitted restore, task/session mismatch recovery, and reset recovery in the installed consumer-repo path.
- Refreshed beta-readiness docs to reflect the published `1.0.0-beta.0` npm package, npm `latest`/`beta` dist-tags, GitHub tag state, global install smoke, and packaged client trial coverage.
- Improved lightweight TypeScript/JavaScript retrieval by treating const-assigned arrow/function declarations as function symbols and documenting the beta retrieval boundary.
- Added a beta trial checklist for real MCP client trials, pass/fail criteria, recovery scenarios, and explicit durable-workflow beta exclusions.
- Reduced default MCP `grape_get_context` payload duplication for beta trials. The tool now returns compact `agent_pack` output by default, keeps full artifacts behind `outputMode: "full"` / `grape_get_artifact`, summarizes MCP text instead of duplicating structured JSON, and reports serialized agent-output token estimates in benchmarks.
- Moved experimental MCP `agentGraph` data out of default `agent_pack` output. `outputMode: "full"` still returns the graph for inspection.
- `grape bench --fixture <name>` now reads the default benchmark task from each fixture's `grape-fixture.json` metadata instead of using a TypeScript discount-app task for every fixture. The benchmark suite now includes the polyglot fallback and monorepo-lite fixtures as scripted no-change transport scenarios.
- Hardened local compile performance without changing transport semantics: repeated compiles reuse the already-captured repo snapshot, skip existing snapshot evidence/index materialization when rows are complete, use narrower session-ledger queries, and apply bounded SQL prefiltering before lexical match fallback.

## 0.1.0-alpha.3 - 2026-05-31

### Added

- Added a purpose-built session reset benchmark fixture proving `resetSession: true` / `--reset-session` emits `INVALIDATE_PREVIOUS`, forces a current resend, and avoids reset-turn omission.
- Added restore-path protocol golden coverage for `RESTORE_AVAILABLE` restore IDs, session binding, restored body shape, and MCP output without absolute root paths.
- Added dedicated task/session mismatch exit classification through CLI exit code `6`.
- Added architecture standards for functional core / imperative shell, purposeful same-shape transforms, boundary error classification, clear naming, and avoiding nested policy conditionals.

### Changed

- Refreshed the README around the product promise: install Grape, keep using the coding agent normally, and let MCP `grape_get_context` drive session-scoped context tracking with safe deltas, stale invalidation, pinned safety context, and restorable omissions.
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
- Added bounded exact-source evidence sections with deterministic proof refs to repository-derived context artifacts.
- Added session reset recovery through CLI `--reset-session` and MCP `resetSession: true`, returning `INVALIDATE_PREVIOUS` and forcing full current resend for reused sessions.
- Added pinned active project rules from trusted rule files to repository-derived context artifacts.
- Added safe FTS5 lexical index persistence for allowed source records as an indexing foundation.
- Updated public context pack items returned by CLI, artifact JSON, and MCP to use the V1 `ContextPackItem` output shape.
- Added task source retrieval for context compilation, using safe FTS rows, symbol/path matches, and MCP seed refs to prioritize exact source evidence.
- Added conservative token-budget evaluation for CLI `--token-budget` and MCP `tokenBudget`, including unsafe output when required context cannot fit.
- Added public V1 `ContextArtifact` JSON output for compile artifacts while keeping restore verification data in an internal repository backing file.
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
