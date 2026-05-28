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
- Summary: added a repository-derived context artifact compiler and CLI fallback path. `grape compile --task <text>` now auto-bootstraps local state, captures/persists the current repo snapshot, compiles from source evidence and lightweight relationship indexes, prepares artifact files before durable send ledgers are committed, persists session-scoped diff rows, writes artifact files under `.grape/artifacts/`, and blocks obvious raw secrets before artifact output. Later slices changed public JSON to a V1 `ContextArtifact` projection with an internal scaffold sidecar.
- Checks run: `npm run typecheck`; focused behavior tests; `npm run check`; `npm run build`.
- Risks/follow-ups: the JSON/Markdown files are still scaffold `InMemoryContextArtifactShape` outputs, not final V1 artifact schema. MCP stdio, exact-span high-risk policies, stronger secret/redaction scanning, restore lookup, and broader inspection commands remain required. Risk overlays intentionally return unsafe output until exact spans exist.

### 2026-05-26 - MCP Get Context Foundation

- Author/agent: Gaille Amolong / Codex
- Summary: added the first MCP stdio adapter with framed JSON-RPC handling, `initialize`, `tools/list`, `tools/call`, `grape_get_context`, and `grape_get_status`. The MCP adapter is thin: `grape_get_context` calls the local compile service and returns structured context-pack items plus Markdown, while `grape_get_status` calls the local status service.
- Checks run: `npm run typecheck`; `npm run build:test`; focused CLI/MCP behavior tests.
- Risks/follow-ups: this is not the complete V1 MCP surface. The current `grape_get_context` path requires `sessionId` or `agentSessionId` to preserve session-scoped diffing and still needs the final ContextArtifact schema plus restricted write tools. Later slices added seed-aware source retrieval and token-budget evaluation.

### 2026-05-26 - Omitted Context Restore Lookup

- Author/agent: Gaille Amolong / Codex
- Summary: added product-facing restore lookup for session-scoped omitted context. `grape omitted --session <id>` lists omitted rows, `grape omitted --session <id> --token <restoreToken>` validates and restores an omitted scaffold section, and `grape_get_omitted_item` exposes the same app service over MCP stdio.
- Checks run: `npm run typecheck`; `npm run build:test`; focused CLI/MCP behavior tests.
- Risks/follow-ups: restore currently verifies internal scaffold sidecar files while public JSON exposes the V1 projection. Branch-switch/session-reset recovery and the remaining MCP read/write tools still need implementation. The restore path fails closed on tampered scaffold artifact bodies, blocked redaction status, stale dependencies, and mismatched stored artifact/dependency metadata.

### 2026-05-26 - Artifact Inspection Surface

- Author/agent: Gaille Amolong / Codex
- Summary: added metadata-first artifact inspection through `grape artifacts`, `grape artifacts --artifact <id>`, and MCP `grape_get_artifact`. The surface returns stored artifact metadata, dependency rows, warnings, unsafe reasons, and repo-relative public file refs without exposing absolute roots over MCP.
- Checks run: `npm run typecheck`; `npm run build:test`; focused CLI/MCP behavior tests.
- Risks/follow-ups: this is an inspection surface over the scaffold artifact shape. Final V1 artifact schema, exact-span policies, and the remaining MCP read/write tools are still pending.

### 2026-05-26 - Branch Switch Invalidation

- Author/agent: Gaille Amolong / Codex
- Summary: explicit session reuse across Git branches now updates session compile state under the durable build lock, records `session_invalidated` events with `reason: "branch_changed"`, and emits `INVALIDATE_PREVIOUS` context pack items for stale previous-branch context through CLI and MCP.
- Checks run: `npm run typecheck`; focused CLI/MCP/storage behavior tests; full checks before commit.
- Risks/follow-ups: branch/global distinction still depends on future durable claim scope filtering.

### 2026-05-26 - Exact Source Evidence Scaffold

- Author/agent: Gaille Amolong / Codex
- Summary: repository-derived scaffold artifacts now include bounded exact-source evidence for selected allowed source records. The local reader verifies source hashes before creating deterministic proof refs and excerpt hashes, and the compiler records proof dependencies alongside source dependencies.
- Checks run: full checks before commit.
- Risks/follow-ups: this is a scaffold proof foundation. Durable claim promotion, task-specific high-risk exact spans, and final V1 artifact schema remain pending.

### 2026-05-26 - Session Reset Recovery

- Author/agent: Gaille Amolong / Codex
- Summary: added explicit session reset recovery for the scaffold diff path. CLI `grape compile --reset-session` and MCP `grape_get_context` with `resetSession: true` now record `session_reset` invalidation events, emit `INVALIDATE_PREVIOUS` for active prior sent items, and force current scaffold sections to be resent instead of omitted.
- Checks run: focused durable/CLI/MCP behavior tests before full verification.
- Risks/follow-ups: reset recovery still operates on scaffold diff rows internally. Durable claim/proof invalidation remains pending.

### 2026-05-26 - Pinned Active Project Rules

- Author/agent: Gaille Amolong / Codex
- Summary: repository-derived scaffold artifacts now include a pinned `active-project-rules` section when trusted rule files are present. Rule file excerpts use the same source-hash verification, proof refs, and dependency refs as exact-source evidence, and scanner classification now covers `AGENTS.md`, `.cursor/rules`, `.cursorrules`, `.aiassistant/rules`, `.junie/guidelines.md`, and `.grape/` rule paths when they are Git-visible and privacy-allowed.
- Checks run: focused source-excerpt, repo-snapshot, repository-artifact, and CLI behavior tests; `npm run check`; `npm run build`; `git diff --check`.
- Risks/follow-ups: this renders exact rule text as pinned context only. Parsed `project_rules`, conflicts, nested scope resolution, candidate/generated rules, and rule-specific MCP/CLI inspection remain pending.

### 2026-05-26 - Safe FTS Index Foundation

- Author/agent: Gaille Amolong / Codex
- Summary: added `fts_entries` metadata rows plus an FTS5 text table for allowed source records. FTS persistence now reuses source-hash/path/binary/symlink guards, skips secret-looking text, exposes source-linked search results through storage repositories, and remains separate from compiler selection policy.
- Checks run: focused file-index and storage-runtime behavior tests; `npm run check`; `npm run build`; `git diff --check`.
- Risks/follow-ups: FTS rows are persisted and searchable. Later slices use them for scaffold source selection; durable current-valid claim filtering and final high-risk compiler policy remain pending.

### 2026-05-26 - V1 ContextPackItem Output Mapping

- Author/agent: Gaille Amolong / Codex
- Summary: public CLI JSON, artifact JSON, Markdown rendering, and MCP `grape_get_context` output now map internal scaffold diff rows into V1-shaped `ContextPackItem` objects. Pack items expose `content`, `itemKind`, `itemRef`, `inputRefs`, `restoreId`, token counts, and safety flags while durable storage can continue using scaffold rows internally.
- Checks run: focused CLI/MCP behavior tests; `npm run check`; `npm run build`; `git diff --check`.
- Risks/follow-ups: the public pack item shape is now V1-shaped, but the stored artifact body remains the repository-derived scaffold artifact. Final V1 `ContextArtifact` schema promotion remains pending.

### 2026-05-26 - Task Source Retrieval Foundation

- Author/agent: Gaille Amolong / Codex
- Summary: scaffold context compilation now resolves task source hints from task terms, MCP seed file/symbol/test refs, safe FTS rows, and symbol/path metadata. Selected source refs are surfaced in a `task-retrieval` section and prioritized across source manifests, dependency manifests, symbol summaries, and bounded exact-source evidence.
- Checks run: focused retrieval/source-excerpt/CLI/MCP/repository-artifact behavior tests before full verification.
- Risks/follow-ups: retrieval is still source selection over allowed snapshot records. Durable current-valid claim retrieval, final ContextArtifact schema, budget pruning/compression policy, and high-risk exact-span policies remain pending.

### 2026-05-26 - Token Budget Safety Evaluation

- Author/agent: Gaille Amolong / Codex
- Summary: CLI `grape compile --token-budget <tokens>` and MCP `tokenBudget` now evaluate whether the generated context pack fits the requested budget. The evaluator reports estimated pack tokens, required context tokens, warnings, and unsafe reasons; it fails closed with `token_budget_below_required_context` when pinned/exact/invalidation context cannot fit.
- Checks run: focused budget/CLI/MCP behavior tests before full verification.
- Risks/follow-ups: this slice evaluates budget fit only. It deliberately does not prune or compress context yet, because V1 still needs final task policy and compression-cache rules before safe budget pruning.

### 2026-05-26 - Public V1 ContextArtifact Projection

- Author/agent: Gaille Amolong / Codex
- Summary: public compile JSON now exposes `artifactFormat: "grape.context-pack.v1"`, a V1 `contextArtifact` projection, V1-shaped context pack items, omitted metadata, token metrics, and budget status. CLI `--json` and MCP `grape_get_context` also return the projected `contextArtifact`. Internal scaffold artifact bodies are now written to `.scaffold.json` sidecars so omitted restore can still validate section hashes without making the scaffold body the public contract.
- Checks run: focused repository-artifact, CLI, and MCP behavior tests before full verification.
- Risks/follow-ups: the V1 `ContextArtifact` is still projected from the repository-derived scaffold. Durable current-valid claim retrieval, task-policy-specific exact spans, and final high-risk safe compile remain pending.

### 2026-05-26 - Exact Source Proof Row Persistence

- Author/agent: Gaille Amolong / Codex
- Summary: local compile now validates bounded exact source and rule excerpts against trusted allowed source records, persists accepted direct proof rows in `proofs`, rejects invalid excerpt hashes, and compiles only from accepted proof excerpts. The proof storage repository, proof validator, and app orchestration remain split by ownership.
- Checks run: focused proof-store and CLI behavior tests before full verification.
- Risks/follow-ups: persisted proof rows are scaffold proof material only. Durable claim candidates, belief gating, current-valid claim retrieval, and proof/claim stale invalidation remain pending.

### 2026-05-26 - Proof Inspection Surface

- Author/agent: Gaille Amolong / Codex
- Summary: added `grape proofs`, `grape proofs --proof <id>`, `grape proofs --source <sourceId>`, and MCP `grape_get_proofs` so persisted proof rows are inspectable without raw excerpts or absolute root paths. The service is app-owned; CLI and MCP adapters only parse and render.
- Checks run: focused CLI/MCP behavior tests before full verification.
- Risks/follow-ups: this inspects claimless scaffold proof rows. Claim-linked `grape proofs <claim_id>` remains pending until durable claims exist.

### 2026-05-26 - Proof-Aware Omitted Restore Validation

- Author/agent: Gaille Amolong / Codex
- Summary: omitted-context restore now validates proof dependencies against persisted proof rows before returning omitted bodies. Missing proof rows, changed excerpt hashes, and changed source hashes make restore return stale metadata.
- Checks run: focused CLI omitted-restore regression test before full verification.
- Risks/follow-ups: proof invalidation is enforced at restore time for scaffold artifacts. Durable claim stale-state propagation remains pending.

### 2026-05-26 - High-Risk Exact Context Policy

- Author/agent: Gaille Amolong / Codex
- Summary: added compiler-owned high-risk policy evaluation. Risk overlays now require task-selected proof-backed exact source/config/rule excerpts and fail closed with `risk_overlay_missing_exact_context` when retrieval cannot select one.
- Checks run: focused compiler/CLI/MCP behavior tests before full verification.
- Risks/follow-ups: this is still source-selection over scaffold evidence, not durable current-valid claim retrieval or full exact-span ranking.

### 2026-05-26 - Narrow Source-Excerpt Claim Foundation

- Author/agent: Gaille Amolong / Codex
- Summary: local compile now creates claim candidates from validated exact-source proof rows, promotes only the narrow `repository_source_excerpt_exists` claim type, links proof rows to accepted claims, and exposes active claims through CLI `grape claims --active` and MCP `grape_get_claims`.
- Checks run: focused source-claim, CLI, and MCP behavior tests before full verification.
- Risks/follow-ups: durable claims are inspection-only for now and are not yet used as the primary artifact retrieval input. Broader claim types, contradiction/supersession, and artifact sections over current-valid claims remain pending.

### 2026-05-26 - Current-Valid Claim Artifact Section

- Author/agent: Gaille Amolong / Codex
- Summary: factored current-valid claim resolution into an app helper and fed active narrow source-excerpt claims into the repository artifact compiler. Artifacts now include a `current-valid-claims` `active_claim` section with claim/proof refs and claim dependencies when active claims exist.
- Checks run: focused repository-artifact, CLI, and MCP behavior tests before full verification.
- Risks/follow-ups: only the first narrow claim type is rendered. Broader claim retrieval, contradiction/supersession, and parsed rule claims remain pending.

### 2026-05-26 - Deterministic Symbol Compression Cache

- Author/agent: Gaille Amolong / Codex
- Summary: added `compression_artifacts` and `compression_inputs` storage, a deterministic `symbol_outline` builder, local compile persistence, compiler dependency refs, and a non-proof compression orientation section in public artifacts.
- Checks run: focused compression-cache, repository-artifact, CLI, and storage-runtime behavior tests before full verification.
- Risks/follow-ups: this is the first compression cache foundation only. `rule_digest`, `context_pack_summary`, stale compression invalidation events, and safe budget pruning remain pending.

### 2026-05-26 - Deterministic Rule Digest Compression Cache

- Author/agent: Gaille Amolong / Codex
- Summary: added a deterministic `rule_digest` compression artifact built from verified active rule excerpts. Local compile now persists rule digest inputs as rule hashes, includes the digest as a compression dependency, and renders it only as non-proof orientation while pinned rule text remains exact context.
- Checks run: focused compression-cache and CLI behavior tests before full verification.
- Risks/follow-ups: `context_pack_summary`, stale compression invalidation events, and safe budget pruning remain pending.

### 2026-05-26 - Deterministic Context Pack Summary Cache

- Author/agent: Gaille Amolong / Codex
- Summary: added a deterministic `context_pack_summary` compression artifact builder and local compile persistence after durable pack writes. The cache is derived from latest active, non-compression sent ledger rows for the current branch/head and stores context-artifact input hashes without returning context bodies.
- Checks run: focused compression-cache and CLI behavior tests before full verification.
- Risks/follow-ups: the summary is cached but not rendered into artifacts until section-level compression invalidation avoids making no-change turns stale. Stale compression invalidation events and safe budget pruning remain pending.

### 2026-05-26 - Session Inspection CLI

- Author/agent: Gaille Amolong / Codex
- Summary: added `grape sessions` backed by a local-project app service. The command reports session status, lock status, branch/head scope, task metadata, artifact/sent/omitted/pack counts, event counts, and last event reason without returning context bodies.
- Checks run: focused CLI behavior tests before full verification.
- Risks/follow-ups: stale/conflict-specific inspection commands remain pending until broader stale claim/conflict records exist.

### 2026-05-26 - Stale Invalidation CLI

- Author/agent: Gaille Amolong / Codex
- Summary: added `grape stale` backed by a local-project app service. The command reports emitted `INVALIDATE_PREVIOUS` ledger rows, prior sent item refs, stale reason classification, previous branch/head metadata, and dependency ref counts without returning context bodies.
- Checks run: focused CLI behavior tests before full verification.
- Risks/follow-ups: this is an invalidation-ledger inspector only. Predictive stale analysis for claims, rules, and compression inputs remains pending until those stale records are product-facing.

### 2026-05-26 - MCP Stale Invalidation Tool

- Author/agent: Gaille Amolong / Codex
- Summary: added MCP `grape_get_stale_items` as a read-only adapter over the local stale app service. It optionally filters by session, removes `rootPath` from MCP output, and returns invalidation metadata without context bodies.
- Checks run: focused MCP/CLI behavior tests before full verification.
- Risks/follow-ups: this mirrors emitted invalidation rows only. Predictive stale analysis and conflict inspection remain pending.

### 2026-05-26 - MCP Rules Inspection Tool

- Author/agent: Gaille Amolong / Codex
- Summary: added MCP `grape_get_rules` as a read-only adapter over a local rules app service. It captures the current Git snapshot, classifies trusted rule files, verifies source hashes before reading bounded excerpts, applies the artifact secret scan, removes `rootPath` from MCP output, and reports rejected rule refs without persisting parsed durable rules.
- Checks run: focused MCP/CLI behavior tests before full verification.
- Risks/follow-ups: this exposes current rule excerpts only. Parsed durable `project_rules`, nested scope resolution, generated/candidate rules, and conflict handling remain pending.

### 2026-05-26 - MCP Command And Test Observation Writes

- Author/agent: Gaille Amolong / Codex
- Summary: added restricted MCP `grape_record_command_result` and `grape_record_test_result` tools backed by a local observation app service and pure evidence builders. Agent-reported observations are persisted as temporary `command_run` / `test_run` source rows scoped to the current repo snapshot and context session. Raw command/stdout/stderr bodies are not persisted, and MCP callers cannot mint Grape-observed authority or durable claims.
- Checks run: focused MCP behavior tests before full verification.
- Risks/follow-ups: these are scratch evidence rows only. Grape-observed command runners, `command_runs` / `test_runs` tables, durable proof attachment, and CLI decision workflows remain pending.

### 2026-05-26 - Conflict Inspection Surface

- Author/agent: Gaille Amolong / Codex
- Summary: added typed `claim_edges` storage access plus CLI `grape conflicts` and MCP `grape_get_conflicts`. The surfaces list recorded conflict-like edges and claim summaries without resolving contradictions, merging claims, or pretending detection exists.
- Checks run: focused storage/CLI/MCP behavior tests before full verification.
- Risks/follow-ups: contradiction detection, conflict creation, supersession policy, and artifact conflict sections remain pending.

### 2026-05-26 - Recovery Guidance Surface

- Author/agent: Gaille Amolong / Codex
- Summary: added shared local-project recovery guidance for setup diagnostics, unsafe compile results, lock-conflict errors, stale restore paths, missing Git metadata, root mismatch, and privacy/redaction failures. CLI renders guidance in human/error output, and JSON/MCP surfaces include machine-readable guidance arrays.
- Checks run: focused CLI/MCP behavior tests before full verification.
- Risks/follow-ups: future privacy approval/export/purge flows and remaining MCP write tools must add matching recovery guidance when implemented.

### 2026-05-26 - Restricted MCP Write Surface

- Author/agent: Gaille Amolong / Codex
- Summary: completed the V1 restricted MCP write-tool foundation with `grape_record_candidate`, `grape_record_user_decision`, and `grape_request_user_confirmation`. Candidate writes link temporary `assistant_response` evidence to non-durable claim candidates, user decisions store redacted `user_message` evidence with prompt/response hashes only, and confirmation requests return non-durable request IDs with recovery guidance. The observation/candidate app services now share current-session validation so writes fail if the branch, head, or worktree state has changed since `grape_get_context`.
- Checks run: typecheck before full verification.
- Risks/follow-ups: these tools still do not promote durable truth. Grape-observed command/test runners and broader Trust Kernel promotion flows remain pending.

### 2026-05-26 - Partial Bootstrap Config Repair

- Author/agent: Gaille Amolong / Codex
- Summary: hardened local bootstrap recovery for malformed or incomplete `.grape/config.json`. Status and doctor now identify repairable config damage separately from unsupported future schema versions; `grape init --connect` and compile auto-bootstrap back up repairable invalid configs before writing a fresh local config.
- Checks run: focused CLI behavior tests before full verification.
- Risks/follow-ups: framework/package-manager detection, candidate rules, and broader partial-bootstrap recovery remain pending.

### 2026-05-27 - Compiler Directory Ownership Split

- Author/agent: Gaille Amolong / Codex
- Summary: split `src/core/compiler/` into ownership subdirectories for artifact guards/projection, context-pack mapping, repository-derived compilation, section builders, and policy while preserving `src/core/compiler/index.ts` as the public import boundary.
- Checks run: focused compiler behavior tests before full verification.
- Risks/follow-ups: future compiler work should keep using the ownership folders rather than adding another flat prefix family or generic helper directory.

### 2026-05-27 - Fixture Benchmark Harness

- Author/agent: Gaille Amolong / Codex
- Summary: added `grape bench --fixture <name>` backed by an app-owned benchmark service. The first benchmark copies a named fixture into a temporary Git repo, runs the real local compile/diff path twice with the same session, and reports first-turn/second-turn token costs, restore hints, invalidations, unsafe omissions, stale sends, and threshold failures.
- Checks run: focused benchmark CLI behavior tests before full verification.
- Risks/follow-ups: the harness currently covers `bench_token_reduction_after_first_turn` for named fixtures. Broader benchmark names, gold-label current-valid fixtures, stale-proof fixtures, and threshold calibration remain pending.

### 2026-05-27 - Context Pack Markdown Hardening

- Author/agent: Gaille Amolong / Codex
- Summary: split Markdown rendering into `src/core/compiler/repository/markdown/` and expanded context-pack Markdown output so CLI and MCP artifacts expose artifact summary, diff counts, pack item input refs, omitted/restore metadata, artifact section summaries, dependency manifest details, token/budget status, and warnings/safety fields.
- Checks run: focused CLI/MCP/compiler behavior tests; `npm run check`; `npm run build`; `git diff --check`.
- Risks/follow-ups: JSON remains the canonical contract; final artifact work still needs broader durable current-valid claim/proof retrieval and safe budget pruning.

### 2026-05-27 - Bootstrap Project Detection

- Author/agent: Gaille Amolong / Codex
- Summary: added app-owned bootstrap detection to `grape init --connect`, reporting language/framework hints, package manager, script names, derived commands, test command, entry points, config files, confidence levels, warnings, and non-durable candidate rules.
- Checks run: focused CLI behavior test; `npm run check`; `npm run build`; `git diff --check`.
- Risks/follow-ups: detection is intentionally manifest/config based and does not confirm candidate rules; route detection, broad framework extractors, and user-confirmed durable rules remain pending.

### 2026-05-27 - Compiler Repository Ownership Refinement

- Author/agent: Gaille Amolong / Codex
- Summary: refined `src/core/compiler/repository/` into focused `manifest/`, `proofs/`, `validation/`, `rendering/`, and split `selection/` ownership folders while preserving the public compiler export boundary and artifact behavior.
- Checks run: `npm run check`; `npm run build`.
- Risks/follow-ups: `repository/sections/sections.ts` remains a readable but broad section aggregator; split individual section families only when new section behavior would otherwise add another responsibility.

### 2026-05-27 - Scanner Diagnostics And Non-Text Rejections

- Author/agent: Gaille Amolong / Codex
- Summary: added Git snapshot rejection gates for oversized and binary-looking files before source evidence ingestion, kept file read/rejection policy isolated in `src/core/git/file-manifest.ts`, persisted those skips as source rejections with metadata hashes/sizes only, and surfaced aggregate scan diagnostics through init/status output.
- Checks run: focused repo-snapshot/evidence/CLI behavior tests; `npm run check`; `npm run build`; `npm run docs:check`.
- Risks/follow-ups: staged and untracked source-scope splitting, approval records, and richer scan diagnostics by source kind remain pending.

### 2026-05-27 - Public Artifact Contract Golden Coverage

- Author/agent: Gaille Amolong / Codex
- Summary: added focused behavior coverage for the public V1 context artifact JSON envelope, dependency/input/section references, context-pack item shape, and MCP Markdown parity with structured context-pack items.
- Checks run: focused context artifact contract behavior test.
- Risks/follow-ups: broader durable-claim retrieval golden fixtures and final artifact-schema hardening remain pending.

### 2026-05-27 - Cross-Platform Path Hardening

- Author/agent: Gaille Amolong / Codex
- Summary: normalized Windows-style separators at indexing path boundaries, rejected traversal and drive-qualified repo paths before file reads, and added focused tests for privacy ignores, safe indexed paths, and import resolution with backslash inputs.
- Checks run: focused cross-platform path and file-index behavior tests.
- Risks/follow-ups: this is separator/unsafe-path coverage, not a full Windows or WSL CI run.

### 2026-05-27 - Git Source Scope Split

- Author/agent: Gaille Amolong / Codex
- Summary: added Git porcelain-derived dirty path scopes to repo snapshots and source evidence ingestion so allowed sources are marked as committed, staged, unstaged, or untracked instead of collapsing every dirty source to unstaged.
- Checks run: focused repo snapshot and evidence behavior tests.
- Risks/follow-ups: approval records and richer scan diagnostics remain pending.

### 2026-05-27 - Compiler Section Builder Split

- Author/agent: Gaille Amolong / Codex
- Summary: moved repository-derived compiler section builders into `src/core/compiler/repository/sections/builders/`, leaving `sections/sections.ts` as the section assembly point and `sections/dependencies.ts` as the section-local dependency-ref helper.
- Checks run: focused compiler/artifact behavior tests; `npm run architecture:check`; `npm run docs:check`; `npm run check`; `npm run build`.
- Risks/follow-ups: future section families should add a focused builder module instead of expanding the assembly file.

### 2026-05-27 - CLI Fallback Commands

- Author/agent: Gaille Amolong / Codex
- Summary: added `grape sync` as the manual input-refresh fallback and `grape diff-context --task <text>` as the explicit compile-plus-session-diff fallback, both as thin CLI adapters over app-owned local-project services.
- Checks run: focused CLI fallback/local-project behavior tests; `npm run check`; `npm run build`.
- Risks/follow-ups: `grape sync` refreshes snapshot/evidence/index state but intentionally does not create artifacts, update sent ledgers, or promote durable claims.

### 2026-05-27 - Privacy Doctor

- Author/agent: Gaille Amolong / Codex
- Summary: implemented `grape doctor --privacy` as a privacy-focused diagnostic view over local-first defaults, `.grape/` Git exclusion, aggregate scanner rejection counts, ignored/private handling, and artifact secret-scan coverage without returning secret values or rejected-file bodies.
- Checks run: focused CLI privacy/local-project behavior tests; `npm run check`; `npm run build`.
- Risks/follow-ups: privacy export, purge, and scoped ignored-file approvals remain deferred until their data contracts are implemented.

### 2026-05-28 - Context Pack Budget Pruning

- Author/agent: Gaille Amolong / Codex
- Summary: moved token-budget policy into the durable pack path so budgeted compiles prune only optional non-safety context before pack rows are persisted. Required task, pinned, exact/safety-critical, omission/restore, and invalidation context is protected, and public artifacts record budget-pruned bodies in `omittedDueToBudget` instead of sending them.
- Checks run: focused context-budget, CLI local-project, and repository-artifact behavior tests under Node 22; `npm run docs:check`; `npm run architecture:check`; `npm run typecheck`; `npm run build`; `npm run build:test`; `npm run check`.
- Risks/follow-ups: this is a conservative optional-pruning policy, not final compression replacement or rendered `context_pack_summary` use. Broader budget ranking, section-level compression invalidation, and durable current-valid retrieval remain pending.
