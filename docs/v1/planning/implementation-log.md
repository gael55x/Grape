# V1 Implementation Log

This log records meaningful implementation-preparation and implementation milestones. It is not a commit log; Git already records individual commits.

Each entry may include:

- date
- author or agent
- milestone
- summary
- tests or checks run
- risks or follow-ups

## Entry Style

Keep entries simple:

- one entry per meaningful milestone
- use `Author/agent: <human contributor> / <agent name>` for AI-assisted work
- no separate entries for small docs-only commits
- no repeated details that are already in Git history

## Entries

### 2026-05-23 - Documentation Foundation Complete

- Author/agent: Gaille Amolong / Codex
- Summary: established the public V1 documentation structure, committed `docs/v1/SPEC.md` as the canonical implementation contract, organized supporting docs by purpose, and added ADRs for the documentation architecture, canonical spec, implementation goals, and docs structure.
- Checks run: docs path/reference checks, git status checks.
- Risks/follow-ups: supporting docs must stay aligned with `docs/v1/SPEC.md`; new V1 docs should use the existing folder map.

### 2026-05-23 - In-Memory Context Loop Planning And Skeleton

- Author/agent: Gaille Amolong / Codex
- Summary: defined the In-Memory Context Loop, added the minimal package/TypeScript skeleton, added the docs structure guard, and exported shared V1 shape types.
- Checks run: `npm run docs:check`.
- Risks/follow-ups: implementation must stay inside the In-Memory Context Loop; TypeScript compiler dependency is not installed yet; MCP transport, compression, and broad indexing remain out of scope.

### 2026-05-23 - In-Memory Context Loop Fixture Baseline

- Author/agent: Gaille Amolong / Codex
- Summary: added the `clean-typescript-app` fixture, documented expected claims/proofs/diff behavior, and added fixture metadata hash validation.
- Checks run: `npm run check`.
- Risks/follow-ups: fixture is static until the in-memory application-service tests are introduced.

### 2026-05-23 - In-Memory Context Loop Contract And State Skeleton

- Author/agent: Gaille Amolong / Codex
- Summary: added shared contract validation and the first state/event transition skeleton for the in-memory path.
- Checks run: `npm run check`.
- Risks/follow-ups: TypeScript compiler is still not installed; checker scripts validate structure and canonical values until the test toolchain is introduced.

### 2026-05-23 - In-Memory Context Loop Repo Snapshot Shape

- Author/agent: Gaille Amolong / Codex
- Summary: added the repo snapshot TypeScript shape and a fixture-based clean snapshot smoke check.
- Checks run: `npm run check`.
- Risks/follow-ups: real Git inspection and persisted snapshots are still out of scope until later In-Memory Context Loop and SQLite work.

### 2026-05-23 - In-Memory Context Loop Trust Shape Baseline

- Author/agent: Gaille Amolong / Codex
- Summary: added evidence, proof validation, claim candidate, and durable claim shapes with a guard that durable claims require non-empty proof refs and matched scope.
- Checks run: `npm run check`.
- Risks/follow-ups: actual proof validation and persistence are not implemented yet.

### 2026-05-23 - In-Memory Context Loop Current-Valid Skeleton

- Author/agent: Gaille Amolong / Codex
- Summary: added the current-valid filtering skeleton and consolidated In-Memory Context Loop smoke checks into one script to avoid a custom test framework.
- Checks run: `npm run check`.
- Risks/follow-ups: this is still a smoke harness; real unit tests should replace source-text checks when the test runner is introduced.

### 2026-05-23 - In-Memory Context Loop Shape Tightening

- Author/agent: Gaille Amolong / Codex
- Summary: removed placeholder snapshot values, required non-empty proof refs for current-valid candidates, and clarified shared dependency direction in architecture docs.
- Checks run: `npm run check`.
- Risks/follow-ups: current-valid still needs stale hash, contradiction, privacy, and dirty-worktree gates before artifact compilation can depend on it.

### 2026-05-23 - In-Memory Context Loop Artifact Builder Skeleton

- Author/agent: Gaille Amolong / Codex
- Summary: added the first context artifact builder shape with guards for dependency manifests, section hashes, blocked redaction, section dependency refs, exact source refs, and exact active-claim proof refs.
- Checks run: `npm run check`.
- Risks/follow-ups: artifact hashing is still input-provided until the real deterministic hash service and golden tests are introduced.

### 2026-05-24 - In-Memory Context Loop Diff Proof

- Author/agent: Gaille Amolong / Codex
- Summary: added the first session-scoped in-memory diff proof with pinned resend, safe unchanged omission, restore metadata, and unsafe omission counting.
- Checks run: `npm run check`.
- Risks/follow-ups: diff state is still in-memory only; durable session ledgers belong to the later Alpha Product Slice.

### 2026-05-24 - In-Memory Token Accounting Baseline

- Author/agent: Gaille Amolong / Codex
- Summary: added deterministic approximate token accounting for naive resend cost, Grape context pack cost, omitted unchanged tokens, pinned overhead, invalidation overhead, unsafe omissions, stale sends, and reduction percent.
- Checks run: `npm run check`.
- Risks/follow-ups: numbers are scaffold estimates only; release benchmark claims require a real tokenizer, scripted workflows, and gold fixtures.

### 2026-05-24 - Project Skeleton Tooling Gates

- Author/agent: Gaille Amolong / Codex
- Summary: added a real TypeScript typecheck gate and Node built-in behavioral tests for the in-memory diff and token accounting path without adding dependencies.
- Checks run: `npm run check`.
- Risks/follow-ups: test build output is temporary under `.tmp/`; richer unit/integration coverage still belongs to later implementation goals.

### 2026-05-24 - Storage Contract Correction

- Author/agent: Gaille Amolong / Codex
- Summary: hardened the alpha storage contract around migration ordering, SQL checksums, session ledger identity, dependency manifest hashes, restore metadata, and serialized-state constraints.
- Checks run: `npm run check`.
- Risks/follow-ups: runtime SQLite apply tests and repository APIs still require a driver/package decision; token benchmark claims still need scripted baselines.

### 2026-05-24 - Dependency And CI Baseline

- Author/agent: Gaille Amolong / Codex
- Summary: pinned TypeScript as a local dev dependency, generated `package-lock.json`, documented `npm ci`, and added a minimal GitHub Actions workflow for `npm run check`.
- Checks run: `npm run check`.
- Risks/follow-ups: runtime SQLite driver selection was resolved by the later SQLite Runtime Migration Baseline; repository APIs still need implementation.

### 2026-05-24 - SQLite Runtime Migration Baseline

- Author/agent: Gaille Amolong / Codex
- Summary: selected Node 22.5+ built-in `node:sqlite` for the initial no-native-package runtime path and added migration apply tests for empty database setup, idempotent re-run, WAL/foreign-key pragmas, and checksum drift before SQL execution.
- Checks run: `npm run check`.
- Risks/follow-ups: repository APIs were started in the later Session Ledger Repository Baseline; transaction-scoped app services are still not implemented.

### 2026-05-24 - Session Ledger Repository Baseline

- Author/agent: Gaille Amolong / Codex
- Summary: added typed SQLite repository wrappers for the persisted session-ledger path: project/repo/snapshot/worktree setup, context sessions, context artifacts, dependencies, sent items, and omitted items.
- Checks run: `npm run check`.
- Risks/follow-ups: transaction-scoped app services and durable diff orchestration are still not implemented.

### 2026-05-24 - Session Ledger Correctness Hardening

- Author/agent: Gaille Amolong / Codex
- Summary: made Node 22.5+ explicit, added ADR-0004, enforced same-session artifact references for sent/omitted/pack ledgers, required restore metadata for restorable omissions, added repository-applied SQLite pragmas, compare-and-set session lock methods, context pack/session event repositories, migration bootstrap rejection for untracked schemas, and a storage transaction helper.
- Checks run: `npm run check`.
- Risks/follow-ups: the durable context build service is still not implemented; the next proof must persist artifact, diff, sent/omitted, and pack rows atomically through one narrow build loop.

### 2026-05-24 - Durable Context Build Proof

- Author/agent: Gaille Amolong / Codex
- Summary: added the first app-level durable context build service for an already-built artifact, with one transaction for artifact dependencies, context pack items, sent ledgers, omitted ledgers, stale manifest invalidations, and token metrics. Split record mapping from orchestration and added explicit modularity standards to prevent godfiles.
- Checks run: `npm run check`.
- Risks/follow-ups: this is not yet CLI/MCP product flow; repo snapshot, evidence, trust, current-valid retrieval, and transport adapters still need their own implementation goals.

### 2026-05-24 - Repo Snapshot And Worktree State Baseline

- Author/agent: Gaille Amolong / Codex
- Summary: added the first Git-backed snapshot service for branch, commit, dirty paths, Git-visible file hashes, ignored-file exclusion, source-kind classification, and deterministic snapshot/worktree hashes. Added a narrow app service that persists project, repo, snapshot, and worktree state records in one transaction through storage repositories.
- Checks run: `npm run check`.
- Risks/follow-ups: the next goal should connect persisted snapshots to evidence collection without adding broad indexing, graph expansion, or transport behavior.

### 2026-05-25 - CLI Setup And Local Bootstrap Foundation

- Author/agent: Gaille Amolong / Codex
- Summary: added the first product-shaped setup slice. The package now exposes the future `grape` binary, `grape init --connect` creates local `.grape/` state, applies migrations, persists a Git snapshot, writes config, and locally excludes `.grape/`; `grape status`, `grape doctor`, and `grape mcp --print-config` provide setup inspection and explicit MCP contract-only guidance. The app setup code is split by local-project responsibility to keep CLI handlers thin, and repo snapshots now filter Git ignored and local privacy ignored paths before reading file bytes.
- Checks run: `npm run check`.
- Risks/follow-ups: this is not yet the full V1 context pipeline. MCP stdio, evidence ingestion, proof validation, current-valid retrieval, repository-derived artifact compilation, artifact files, restore lookup, and richer inspection commands remain required.

### 2026-05-25 - Snapshot Evidence Store Baseline

- Author/agent: Gaille Amolong / Codex
- Summary: added dedicated source/source-rejection storage repositories, a pure repo snapshot evidence collector, and app-level persistence so Git snapshots now store trusted allowed source records and privacy-safe rejection records for ignored/private/unreadable paths in the same snapshot transaction. Rejected file bytes are not read or persisted.
- Checks run: `npm run typecheck`; `npm run test:behavior`; `npm run check`; `npm run build`.
- Risks/follow-ups: dirty files are currently scoped from the dirty-path manifest as `unstaged`; staged and untracked source-scope splitting, proof-span validation, candidate extraction, and current-valid retrieval remain required.

### 2026-05-25 - File Indexing Foundation

- Author/agent: Gaille Amolong / Codex
- Summary: added migration-backed `symbol_nodes` and `symbol_edges`, a split indexing repository, deterministic module/symbol/import extraction for allowed snapshot files, and app-level snapshot persistence for index rows. The first extractor is intentionally lightweight and records confidence/discovery method instead of claiming a complete dependency graph.
- Checks run: `npm run typecheck`; `npm run test:behavior`; `npm run check`; `npm run build`.
- Risks/follow-ups: broad language parsing, FTS entries, exact symbol ranges, persisted skip diagnostics, dynamic import blind-spot reporting, and compiler use of indexed relationships remain required.

### 2026-05-26 - Repository Artifact Compile Path

- Author/agent: Gaille Amolong / Codex
- Summary: added a repository-derived context artifact compiler and CLI fallback path. `grape compile --task <text>` now auto-bootstraps local state, captures/persists the current repo snapshot, compiles from source evidence and lightweight relationship indexes, prepares artifact files before durable send ledgers are committed, persists session-scoped diff rows, writes scaffold JSON/Markdown artifacts under `.grape/artifacts/`, and blocks obvious raw secrets before artifact output.
- Checks run: `npm run typecheck`; focused behavior tests; `npm run check`; `npm run build`.
- Risks/follow-ups: the JSON/Markdown files are still scaffold `InMemoryContextArtifactShape` outputs, not final V1 artifact schema. MCP stdio, exact-span high-risk policies, stronger secret/redaction scanning, restore lookup, and broader inspection commands remain required. Risk overlays intentionally return unsafe output until exact spans exist.

### 2026-05-26 - MCP Get Context Foundation

- Author/agent: Gaille Amolong / Codex
- Summary: added the first MCP stdio adapter with framed JSON-RPC handling, `initialize`, `tools/list`, `tools/call`, `grape_get_context`, and `grape_get_status`. The MCP adapter is thin: `grape_get_context` calls the local compile service and returns structured scaffold context-pack items plus Markdown, while `grape_get_status` calls the local status service.
- Checks run: `npm run typecheck`; `npm run build:test`; focused CLI/MCP behavior tests.
- Risks/follow-ups: this is not the complete V1 MCP surface. The current `grape_get_context` output still exposes scaffold `InMemoryContextPackItemShape` items, requires `sessionId` or `agentSessionId` to preserve session-scoped diffing, uses seed file/symbol/test refs for risk detection but not retrieval narrowing, downgrades ignored seed/budget behavior to `partial_with_risk`, and still needs final ContextArtifact/ContextPackItem schemas, restore lookup, and restricted write tools.

### 2026-05-26 - Omitted Context Restore Lookup

- Author/agent: Gaille Amolong / Codex
- Summary: added product-facing restore lookup for session-scoped omitted context. `grape omitted --session <id>` lists omitted rows, `grape omitted --session <id> --token <restoreToken>` validates and restores an omitted scaffold section, and `grape_get_omitted_item` exposes the same app service over MCP stdio.
- Checks run: `npm run typecheck`; `npm run build:test`; focused CLI/MCP behavior tests.
- Risks/follow-ups: restore currently targets scaffold artifact files, not the final V1 artifact schema. Branch-switch/session-reset recovery and the remaining MCP read/write tools still need implementation. The restore path fails closed on tampered scaffold artifact bodies, blocked redaction status, stale dependencies, and mismatched stored artifact/dependency metadata.
