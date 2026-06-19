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

### 2026-06-19 - Codex MCP Setup Slice

- Author/agent: Gaille Amolong / Codex
- Principles used: no explicit canonical four-principle list was found in root instructions, AGENTS.md, architecture docs, contributor docs, maintainer docs, or design principles during the first release audit. This slice used the fallback principles from the 1.0 mandate: evidence over assumption, small reversible increments, privacy and safety by default, and measured claims with bounded behavior.
- Summary: added Codex-native MCP setup through `grape mcp --install --client codex`, which writes project-local `.codex/config.toml` by adding or replacing only `[mcp_servers.grape]`. The installer preserves unrelated TOML, refuses malformed table headers, treats identical Grape entries as already configured, requires `--force` for conflicting Grape entries, and prints a `codex mcp add grape -- ...` fallback command. MCP `initialize` now returns path-neutral server instructions for session identity, invalidation, and omitted restore behavior. `grape mcp --print-agents-snippet` prints path-neutral AGENTS.md guidance without editing repository rules. The repo-local Codex plugin at `plugins/grape` exposes `grape mcp --stdio` and includes a Grape skill; it ships without hooks.
- Tests or checks run: focused MCP client install behavior tests, focused MCP stdio behavior test, AGENTS snippet output tests, Codex plugin structure check, docs checks, typecheck, package check, install smoke, and full `npm run check` before committing these slices.
- Risks or follow-ups: broader local Codex workflow verification remains a separate Phase 1 slice.

### 2026-06-17 - MCP Client Config Auto-Wiring

- Author/agent: Gaille Amolong / Codex
- Summary: added actual Cursor and Claude Desktop MCP client config installation through `grape mcp --install --client cursor` and `grape mcp --install --client claude`. Cursor writes project-local `.cursor/mcp.json`; Claude Desktop writes `claude_desktop_config.json` only when the platform path can be resolved safely. The flow supports dry-run previews, preserves unrelated config, refuses invalid JSON, treats identical Grape entries as already configured, and requires `--force` before replacing a conflicting existing `mcpServers.grape` entry. This is separate from the 1.0.0-beta.7 stdio framing fix, which did not write client config files.
- Tests or checks run: focused MCP client install behavior tests before the full validation gate.
- Risks or follow-ups: Cline, Continue, generic VS Code, and other clients remain on `grape mcp --print-config` until their config paths can be handled safely.

### 2026-06-17 - MCP Stdio JSON Lines Compatibility

- Author/agent: Gaille Amolong / Codex
- Summary: changed `grape mcp --stdio` from `Content-Length` header framing to MCP newline-delimited JSON-RPC messages, updated the packaged MCP smoke helpers and behavior tests, expanded the packaged beta client trial to cover installed CLI core workflows plus MCP session workflows, and added a cross-platform packaged beta client trial job for Ubuntu, macOS, and Windows.
- Tests or checks run: focused MCP behavior tests, typecheck, and packaged beta client trial.
- Risks or follow-ups: run a human Claude Code or Cursor client trial before broad beta promotion.

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
- Risks/follow-ups: numbers are approximate estimates only; release benchmark claims require a real tokenizer, scripted workflows, and gold fixtures.

### 2026-05-24 - Project Skeleton Tooling Gates

- Author/agent: Gaille Amolong / Codex
- Summary: added a real TypeScript typecheck gate and Node built-in behavioral tests for the in-memory diff and token accounting path without adding dependencies.
- Checks run: `npm run check`.
- Risks/follow-ups: test build output is temporary under `.tmp/`; richer unit/integration coverage still belongs to later implementation goals.

### 2026-05-24 - Storage Contract Correction

- Author/agent: Gaille Amolong / Codex
- Summary: hardened the initial storage contract around migration ordering, SQL checksums, session ledger identity, dependency manifest hashes, restore metadata, and serialized-state constraints.
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
- Risks/follow-ups: broad language parsing, lexical entries, exact symbol ranges, persisted skip diagnostics, dynamic import blind-spot reporting, and compiler use of indexed relationships remain required.

### 2026-05-26 - Repository Artifact Compile Path

- Author/agent: Gaille Amolong / Codex
- Summary: added a repository-derived context artifact compiler and CLI fallback path. `grape compile --task <text>` now auto-bootstraps local state, captures/persists the current repo snapshot, compiles from source evidence and lightweight relationship indexes, prepares artifact files before durable send ledgers are committed, persists session-scoped diff rows, writes artifact files under `.grape/artifacts/`, and blocks obvious raw secrets before artifact output. Later slices changed public JSON to a V1 `ContextArtifact` with an internal repository backing file.
- Checks run: `npm run typecheck`; focused behavior tests; `npm run check`; `npm run build`.
- Risks/follow-ups: the initial JSON/Markdown files were internal repository artifact outputs, not the final public V1 artifact contract. MCP stdio, exact-span high-risk policies, stronger secret/redaction scanning, restore lookup, and broader inspection commands remained required. Risk overlays intentionally returned unsafe output until exact spans existed.

### 2026-05-26 - MCP Get Context Foundation

- Author/agent: Gaille Amolong / Codex
- Summary: added the first MCP stdio adapter with stdio JSON-RPC handling, `initialize`, `tools/list`, `tools/call`, `grape_get_context`, and `grape_get_status`. The MCP adapter is thin: `grape_get_context` calls the local compile service and returns structured context-pack items plus Markdown, while `grape_get_status` calls the local status service.
- Checks run: `npm run typecheck`; `npm run build:test`; focused CLI/MCP behavior tests.
- Risks/follow-ups: this is not the complete V1 MCP surface. The current `grape_get_context` path requires `sessionId` or `agentSessionId` to preserve session-scoped diffing and still needs the final ContextArtifact schema plus restricted write tools. Later slices added seed-aware source retrieval and token-budget evaluation.

### 2026-05-26 - Omitted Context Restore Lookup

- Author/agent: Gaille Amolong / Codex
- Summary: added product-facing restore lookup for session-scoped omitted context. `grape omitted --session <id>` lists omitted rows, `grape omitted --session <id> --token <restoreToken>` validates and restores an omitted repository artifact section, and `grape_get_omitted_item` exposes the same app service over MCP stdio.
- Checks run: `npm run typecheck`; `npm run build:test`; focused CLI/MCP behavior tests.
- Risks/follow-ups: restore verifies internal repository backing files while public JSON exposes the V1 artifact contract. Branch-switch/session-reset recovery and the remaining MCP read/write tools still need implementation. The restore path fails closed on tampered repository artifact bodies, blocked redaction status, stale dependencies, and mismatched stored artifact/dependency metadata.

### 2026-05-26 - Artifact Inspection Surface

- Author/agent: Gaille Amolong / Codex
- Summary: added metadata-first artifact inspection through `grape artifacts`, `grape artifacts --artifact <id>`, and MCP `grape_get_artifact`. The surface returns stored artifact metadata, dependency rows, warnings, unsafe reasons, and repo-relative public file refs without exposing absolute roots over MCP.
- Checks run: `npm run typecheck`; `npm run build:test`; focused CLI/MCP behavior tests.
- Risks/follow-ups: this is an inspection surface over stored artifact metadata. Exact-span policies and the remaining MCP read/write tools were still pending at this point.

### 2026-05-26 - Branch Switch Invalidation

- Author/agent: Gaille Amolong / Codex
- Summary: explicit session reuse across Git branches now updates session compile state under the durable build lock, records `session_invalidated` events with `reason: "branch_changed"`, and emits `INVALIDATE_PREVIOUS` context pack items for stale previous-branch context through CLI and MCP.
- Checks run: `npm run typecheck`; focused CLI/MCP/storage behavior tests; full checks before commit.
- Risks/follow-ups: branch/global distinction still depends on future durable claim scope filtering.

### 2026-05-26 - Exact Source Evidence Foundation

- Author/agent: Gaille Amolong / Codex
- Summary: repository-derived artifacts now include bounded exact-source evidence for selected allowed source records. The local reader verifies source hashes before creating deterministic proof refs and excerpt hashes, and the compiler records proof dependencies alongside source dependencies.
- Checks run: full checks before commit.
- Risks/follow-ups: this is a proof foundation. Durable claim promotion, task-specific high-risk exact spans, and the final public V1 artifact contract remained pending.

### 2026-05-26 - Session Reset Recovery

- Author/agent: Gaille Amolong / Codex
- Summary: added explicit session reset recovery for the context diff path. CLI `grape compile --reset-session` and MCP `grape_get_context` with `resetSession: true` now record `session_reset` invalidation events, emit `INVALIDATE_PREVIOUS` for active prior sent items, and force current sections to be resent instead of omitted.
- Checks run: focused durable/CLI/MCP behavior tests before full verification.
- Risks/follow-ups: reset recovery still operates on internal diff rows. Durable claim/proof invalidation remains pending.

### 2026-05-26 - Pinned Active Project Rules

- Author/agent: Gaille Amolong / Codex
- Summary: repository-derived artifacts now include a pinned `active-project-rules` section when trusted rule files are present. Rule file excerpts use the same source-hash verification, proof refs, and dependency refs as exact-source evidence, and scanner classification now covers `AGENTS.md`, `.cursor/rules`, `.cursorrules`, `.aiassistant/rules`, `.junie/guidelines.md`, and `.grape/` rule paths when they are Git-visible and privacy-allowed.
- Checks run: focused source-excerpt, repo-snapshot, repository-artifact, and CLI behavior tests; `npm run check`; `npm run build`; `git diff --check`.
- Risks/follow-ups: this renders exact rule text as pinned context only. Parsed `project_rules`, conflicts, nested scope resolution, candidate/generated rules, and rule-specific MCP/CLI inspection remain pending.

### 2026-05-26 - Safe Lexical Index Foundation

- Author/agent: Gaille Amolong / Codex
- Summary: added `fts_entries` metadata rows plus a lexical text table for allowed source records. Lexical persistence now reuses source-hash/path/binary/symlink guards, skips secret-looking text, exposes source-linked search results through storage repositories, and remains separate from compiler selection policy.
- Checks run: focused file-index and storage-runtime behavior tests; `npm run check`; `npm run build`; `git diff --check`.
- Risks/follow-ups: lexical rows are persisted and searchable. Later slices use them for source selection; durable current-valid claim filtering and final high-risk compiler policy remain pending.

### 2026-05-26 - V1 ContextPackItem Output Mapping

- Author/agent: Gaille Amolong / Codex
- Summary: public CLI JSON, artifact JSON, Markdown rendering, and MCP `grape_get_context` output now map internal diff rows into V1-shaped `ContextPackItem` objects. Pack items expose `content`, `itemKind`, `itemRef`, `inputRefs`, `restoreId`, token counts, and safety flags while durable storage can continue using internal rows.
- Checks run: focused CLI/MCP behavior tests; `npm run check`; `npm run build`; `git diff --check`.
- Risks/follow-ups: the public pack item shape is now V1-shaped, but broader durable retrieval remained pending.

### 2026-05-26 - Task Source Retrieval Foundation

- Author/agent: Gaille Amolong / Codex
- Summary: context compilation now resolves task source hints from task terms, MCP seed file/symbol/test refs, safe lexical rows, and symbol/path metadata. Selected source refs are surfaced in a `task-retrieval` section and prioritized across source manifests, dependency manifests, symbol summaries, and bounded exact-source evidence.
- Checks run: focused retrieval/source-excerpt/CLI/MCP/repository-artifact behavior tests before full verification.
- Risks/follow-ups: retrieval is still source selection over allowed snapshot records. Durable current-valid claim retrieval, final ContextArtifact schema, budget pruning/compression policy, and high-risk exact-span policies remain pending.

### 2026-05-26 - Token Budget Safety Evaluation

- Author/agent: Gaille Amolong / Codex
- Summary: CLI `grape compile --token-budget <tokens>` and MCP `tokenBudget` now evaluate whether the generated context pack fits the requested budget. The evaluator reports estimated pack tokens, required context tokens, warnings, and unsafe reasons; it fails closed with `token_budget_below_required_context` when pinned/exact/invalidation context cannot fit.
- Checks run: focused budget/CLI/MCP behavior tests before full verification.
- Risks/follow-ups: this slice evaluates budget fit only. It deliberately does not prune or compress context yet, because V1 still needs final task policy and compression-cache rules before safe budget pruning.

### 2026-05-26 - Public V1 ContextArtifact Projection

- Author/agent: Gaille Amolong / Codex
- Summary: public compile JSON now exposes `artifactFormat: "grape.context-pack.v1"`, a V1 `contextArtifact`, V1-shaped context pack items, omitted metadata, token metrics, and budget status. CLI `--json` and MCP `grape_get_context` also return the public `contextArtifact`. Internal repository artifact bodies are now written to `.repository.json` backing files so omitted restore can still validate section hashes without making the backing file the public contract.
- Checks run: focused repository-artifact, CLI, and MCP behavior tests before full verification.
- Risks/follow-ups: durable current-valid claim retrieval, task-policy-specific exact spans, and final high-risk safe compile remained pending.

### 2026-05-26 - Exact Source Proof Row Persistence

- Author/agent: Gaille Amolong / Codex
- Summary: local compile now validates bounded exact source and rule excerpts against trusted allowed source records, persists accepted direct proof rows in `proofs`, rejects invalid excerpt hashes, and compiles only from accepted proof excerpts. The proof storage repository, proof validator, and app orchestration remain split by ownership.
- Checks run: focused proof-store and CLI behavior tests before full verification.
- Risks/follow-ups: persisted proof rows are proof material only. Durable claim candidates, belief gating, current-valid claim retrieval, and proof/claim stale invalidation remain pending.

### 2026-05-26 - Proof Inspection Surface

- Author/agent: Gaille Amolong / Codex
- Summary: added `grape proofs`, `grape proofs --proof <id>`, `grape proofs --source <sourceId>`, and MCP `grape_get_proofs` so persisted proof rows are inspectable without raw excerpts or absolute root paths. The service is app-owned; CLI and MCP adapters only parse and render.
- Checks run: focused CLI/MCP behavior tests before full verification.
- Risks/follow-ups: this inspects claimless proof rows. Claim-linked `grape proofs <claim_id>` remains pending until durable claims exist.

### 2026-05-26 - Proof-Aware Omitted Restore Validation

- Author/agent: Gaille Amolong / Codex
- Summary: omitted-context restore now validates proof dependencies against persisted proof rows before returning omitted bodies. Missing proof rows, changed excerpt hashes, and changed source hashes make restore return stale metadata.
- Checks run: focused CLI omitted-restore regression test before full verification.
- Risks/follow-ups: proof invalidation is enforced at restore time for repository artifacts. Durable claim stale-state propagation remains pending.

### 2026-05-26 - High-Risk Exact Context Policy

- Author/agent: Gaille Amolong / Codex
- Summary: added compiler-owned high-risk policy evaluation. Risk overlays now require task-selected proof-backed exact source/config/rule excerpts and fail closed with `risk_overlay_missing_exact_context` when retrieval cannot select one.
- Checks run: focused compiler/CLI/MCP behavior tests before full verification.
- Risks/follow-ups: this is still source-selection over exact evidence, not broad durable current-valid claim retrieval or full exact-span ranking.

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
- Risks/follow-ups: rendering and stale compression invalidation were deferred at the time and later addressed by the context pack summary rendering slice. Safe budget pruning remained pending at this point.

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
- Risks/follow-ups: this is a conservative optional-pruning policy, not final compression replacement. Broader budget ranking and durable current-valid retrieval remain pending.

### 2026-05-28 - Agent Artifact Annotation Boundary

- Author/agent: Gaille Amolong / Codex
- Summary: added ADR-0008 to keep V1 artifact-first by deferring rendered agent-authored artifact annotations. Restricted MCP write tools remain the safe foundation for temporary evidence, candidates, hashes, and confirmation requests without mutating artifact bodies or promoting durable truth.
- Checks run: `npm run docs:check`.
- Risks/follow-ups: V1.1 annotation work must define a separate non-authoritative overlay, proof/scope boundaries, schema, rendering rules, and invalidation behavior before implementation.

### 2026-05-28 - Purpose-Based Implementation Naming

- Author/agent: Gaille Amolong / Codex
- Summary: removed release-stage/version prefixes from implementation filenames and source symbols where the version was not an external contract. Compiler artifact output-mapping files now use purpose names, the initial storage migration no longer uses an alpha label, internal extractor labels use capability names, and migration planning tolerates filename-only drift when ID/checksum still match.
- Checks run: `npm run docs:check`; `npm run architecture:check`; `npm run storage:check`; `npm run typecheck`; `npm run build`; `npm run build:test`; focused storage, compiler, indexing, and CLI behavior tests; `npm run check`.
- Risks/follow-ups: versioned docs namespaces and artifact format strings intentionally remain versioned because they are external contract identifiers, not implementation filename prefixes.

### 2026-05-28 - Context Pack Summary Stale Filtering

- Author/agent: Gaille Amolong / Codex
- Summary: local artifact assembly now builds a base artifact before rendering `context_pack_summary`, filters prior sent ledger rows through current dependency staleness, and excludes rows the current compile will invalidate from compression orientation.
- Checks run: focused compression cache, durable context build, CLI local-project, and repository artifact behavior tests before broader verification.
- Risks/follow-ups: compression remains deterministic orientation only. Richer replacement policy and model-assisted summaries remain deferred.

### 2026-05-28 - Local Database Bootstrap Repair

- Author/agent: Gaille Amolong / Codex
- Summary: bootstrap-capable flows now repair unusable local SQLite state by renaming `.grape/grape.db` to a timestamped invalid backup before recreating migrations and snapshot/index state. `status` and `doctor` fail the database/migration checks with recovery guidance instead of mutating local state.
- Checks run: focused CLI bootstrap recovery tests before broader verification.
- Risks/follow-ups: repair preserves the unusable database file but recreates session ledgers from scratch, so agents may receive a full resend after repair.

### 2026-05-28 - Multi-Window Exact Source Excerpts

- Author/agent: Gaille Amolong / Codex
- Summary: local exact source excerpt selection can now emit up to two non-overlapping proof windows for one selected source when task retrieval supplies distant symbol anchors. Query-term windowing remains a fallback only when no symbol anchors exist for that source, so symbol-selected proof spans stay narrow and task-specific.
- Checks run: focused source-excerpt, CLI local-project, proof/claim, and repository artifact behavior tests before broader verification.
- Risks/follow-ups: windows are still line-based over the lightweight symbol index. Full AST body ranges and richer test/code ranking remain pending.

### 2026-05-28 - Task-Anchored Exact Source Proof Windows

- Author/agent: Gaille Amolong / Codex
- Summary: split local source excerpt handling into a focused ownership folder and changed exact source proof excerpt selection so task query terms anchor the excerpt window when a selected source contains a matching line. Proofs still require path safety checks, source-hash verification, excerpt hashes, and line spans.
- Checks run: focused source-excerpt and repository-artifact behavior tests; `npm run typecheck`; broader gates before commit.
- Risks/follow-ups: matching is still lexical and uses the first matching line only. Richer exact-span ranking across symbol body ranges, tests, and multiple relevant spans remains pending.

### 2026-05-28 - Portable Lexical Search Runtime

- Author/agent: Gaille Amolong / Codex
- Summary: replaced the mandatory SQLite FTS5 virtual table with normal SQLite text rows plus app-owned deterministic lexical matching so local bootstrap does not depend on a Node build exposing FTS5. The storage migration planner now accepts the previous FTS5 migration checksum for migration `0003` as a documented compatibility checksum.
- Checks run: focused storage/file-index behavior tests; Node runtime smoke under Node 23 without FTS5; broader gates before commit.
- Risks/follow-ups: table-backed lexical matching is less capable than FTS5 ranking. Richer relevance ranking remains pending and should not be treated as proof or current-valid filtering.

### 2026-05-28 - CLI Runtime Guard

- Author/agent: Gaille Amolong / Codex
- Summary: added a CLI runtime guard around storage-backed commands so older Node versions receive explicit recovery guidance before the CLI imports `node:sqlite`. Static help, command-specific help, `grape mcp`, and `grape mcp --print-config` remain available without the storage runtime, while `grape doctor --json` can emit a minimal machine-readable `node_runtime` failure.
- Checks run: focused CLI runtime guard behavior tests before broader verification.
- Risks/follow-ups: V1 still requires Node 22.5+ because the accepted local SQLite path uses `node:sqlite`; a Node 20-compatible fallback would need a separate storage-runtime ADR.

### 2026-05-28 - Symbol-Anchored Exact Source Proof Windows

- Author/agent: Gaille Amolong / Codex
- Summary: carried task-selected symbol line anchors from retrieval into local exact source excerpt selection. Matched symbols now guide proof windows before generic query-term fallback, and the task-retrieval artifact section renders the selected source anchors.
- Checks run: focused task retrieval and source excerpt behavior tests before broader verification.
- Risks/follow-ups: symbol anchors use the current lightweight regex index and first matching anchor per source. Richer AST spans, test linkage, and multiple relevant spans remain pending.

### 2026-05-28 - Path-Like Test Seed Retrieval

- Author/agent: Gaille Amolong / Codex
- Summary: changed task retrieval so MCP `tests` entries that look like repository paths, such as `tests/foo.test.ts`, select matching allowed test source files as exact source context. The task-retrieval artifact section now renders test seed refs separately, while free-form test names remain retrieval terms.
- Checks run: focused task retrieval, repository artifact, source excerpt, and MCP stdio behavior tests before broader verification.
- Risks/follow-ups: selected test file excerpts prove source existence only. Grape-observed test execution proofs, broader test-to-code linkage, and multi-span test/code ranking remain pending.

### 2026-05-28 - Related Test Retrieval

- Author/agent: Gaille Amolong / Codex
- Summary: fed lightweight import relationships into task retrieval so test files that import task-selected source files can be selected as related exact source context and rendered as related test refs.
- Checks run: focused task retrieval, repository artifact, and MCP stdio behavior tests before broader verification.
- Risks/follow-ups: import-related tests are orientation only. They do not prove the test was run or that behavior is correct; Grape-observed result claims prove only a specific observed run result, not behavior correctness.

### 2026-05-28 - Global Package Readiness

- Author/agent: Gaille Amolong / Codex
- Summary: prepared the package for the documented global install path by removing the private package flag, copying SQL migrations into `dist/` after build, and adding a package dry-run gate that verifies the packed CLI, README/changelog, and runtime migrations while excluding source, tests, local state, dependencies, and private planning docs.
- Checks run: `npm run package:check`; `npm run check`.
- Risks/follow-ups: the package remains unpublished, and V1 still requires Node 22.5+ for storage-backed commands because the accepted SQLite runtime uses `node:sqlite`.

### 2026-05-28 - Context Pack Summary Rendering

- Author/agent: Gaille Amolong / Codex
- Summary: rendered deterministic `context_pack_summary` compression orientation on later compile turns by rebuilding it from current active, non-compression sent-ledger rows before artifact compilation. Durable diffing now compares prior/current section dependency refs and hashes when the artifact manifest changes, so stale compression orientation emits invalidation without forcing unrelated unchanged sections to resend.
- Checks run: focused durable context build, CLI local-project, compression cache, and repository artifact behavior tests before broader verification.
- Risks/follow-ups: this is still deterministic ledger orientation, not model memory or compression replacement. Broader compression replacement policy and richer current-valid durable retrieval remain pending.

### 2026-05-28 - Task-Scoped Claims And Exact Evidence

- Author/agent: Gaille Amolong / Codex
- Summary: tightened task-specific context generation so exact-source proof creation and rendered current-valid claim sections stay scoped to task-selected source refs when retrieval has concrete matches. Broad exact-source fallback still keeps no-match artifacts inspectable, and broad active-claim inspection remains available through CLI/MCP.
- Checks run: focused CLI local-project, task retrieval, repository artifact, and source-claim behavior tests before broader verification.
- Risks/follow-ups: retrieval is still lexical/lightweight-symbol based. Broader durable claim types, contradiction/supersession, behavior/correctness claims from observed runs, and richer multi-span ranking remain pending.

### 2026-05-30 - Context Transport Protocol Roadmap

- Author/agent: Gaille Amolong / Composer
- Summary: adopted ADR-0010 anchoring V1 on session-safe `ContextPack` transport, refocused root `ROADMAP.md` into product stages, and aligned `implementation-roadmap.md` with compile-vs-transport code ownership, a V1 feature filter, and transport-first alpha exit criteria.
- Checks run: `npm run docs:check`.
- Risks/follow-ups: implementation must follow the feature filter; next work is protocol golden tests, compiler hardening, and multi-fixture benchmarks (see `ROADMAP.md`).

### 2026-05-30 - Publish path and install smoke

- Author/agent: Gaille Amolong / Composer
- Summary: fixed npm bin entry detection for symlinked `grape`, added `npm run install:check` for pack, install, help/init/two-turn compile, bumped package version to `0.1.0-alpha.1`, and published `grape-context` to npm.
- Checks run: `npm run check`.
- Risks/follow-ups: protocol golden tests and multi-fixture benchmarks remain open.

### 2026-05-30 - E2E benchmark suite and CI git fix

- Author/agent: Gaille Amolong / Composer
- Summary: fixed protocol golden branch test git identity on CI, added `npm run benchmark:run` and `npm run e2e:alpha`, and recorded local benchmark baselines in `quality/benchmarks.md`.
- Checks run: `npm run check`, `npm run e2e:alpha`, `npm run benchmark:run`.
- Risks/follow-ups: refresh baseline table when fixtures or compiler output changes materially.

### 2026-05-30 - Protocol golden tests and multi-fixture benchmarks

- Author/agent: Gaille Amolong / Composer
- Summary: added `context-pack-protocol-golden` behavior tests, `grape bench` scenarios for branch-switch and stale-source fixtures, wire-contract notes in `context-diff.md`, and benchmark routing by fixture name.
- Checks run: `npm run check` (164 behavior tests).
- Risks/follow-ups: publish baseline metrics to docs; session-reset fixture bench still open.

### 2026-05-30 - CI Node 22.13 and roadmap wording

- Author/agent: Gaille Amolong / Composer
- Summary: raised the documented runtime floor to Node 22.13+ so CI and install smoke match `node:sqlite` without `--experimental-sqlite`; install smoke passes `NODE_OPTIONS` for spawned `grape` on 22.5–22.12; replaced numeric roadmap headings with Done / Now / Next / Later.
- Checks run: `npm run check`.
- Risks/follow-ups: contributors on Node 22.5–22.12 must set `NODE_OPTIONS=--experimental-sqlite` until they upgrade.

### 2026-05-31 - Agent Session And Beta Readiness Alignment

- Author/agent: Gaille Amolong / Codex
- Summary: added the agent session contract, refreshed alpha.2 setup and roadmap/status docs, documented beta readiness gates, improved task/session mismatch recovery guidance, hardened packaged install and alpha e2e smoke around exact tarball/package metadata and MCP stdio coverage, and aligned branch/stale fixture metadata with invalidation benchmark behavior.
- Checks run: `npm run install:check`; `npm run fixtures:check`; `npm run e2e:alpha`; `npm run docs:check`; `npm run check`; `npm run benchmark:run`.
- Risks/follow-ups: task/session mismatch still needs dedicated exit classification; package-lock metadata alignment and external benchmark workspace alignment remain approval-gated.

### 2026-05-31 - Session Reset And Restore Protocol Hardening

- Author/agent: Gaille Amolong / Codex
- Summary: added the purpose-built `session-reset-typescript-app` fixture and `bench_diff_vs_naive_resend` benchmark to prove explicit reset invalidates prior context, sends fresh current context, and avoids reset-turn omission. Added restore-path protocol golden coverage for `RESTORE_AVAILABLE` restore IDs, session-bound lookup, restored body shape, and MCP no-root-path output.
- Checks run: focused benchmark harness test; `npm run fixtures:check`; `npm run benchmark:run`; focused context-pack protocol golden test; `npm run docs:check`.
- Risks/follow-ups: full beta gates still need to be rerun after the remaining exit-classification and metadata alignment work.

### 2026-05-31 - Task Session Mismatch Exit Classification

- Author/agent: Gaille Amolong / Codex
- Summary: moved explicit task/session mismatch failures out of the generic storage/schema CLI exit bucket and documented the dedicated exit code while preserving the existing recovery guidance.
- Checks run: focused CLI local-project behavior test; `npm run docs:check` before broader beta gates.
- Risks/follow-ups: arbitrary prompt rewording still creates a distinct task/session identity by design; beta docs and clients must keep the stable-session contract visible.

### 2026-05-31 - Alpha.2 Metadata Alignment And Published Smoke

- Author/agent: Gaille Amolong / Codex
- Summary: aligned this repo's package-lock root metadata with `grape-context@0.1.0-alpha.2` and Node `>=22.13.0`, aligned the external benchmark workspace dependency metadata to the registry alpha.2 package, and ran the external published-package smoke without changing benchmark methodology.
- Checks run: external `npm install grape-context@0.1.0-alpha.2 --ignore-scripts --audit=false --fund=false`; external `GRAPE_BIN=.../node_modules/.bin/grape node smoke-published.mjs` passed 8/8 checks.
- Risks/follow-ups: the external benchmark workspace is not a Git repository, so its dependency alignment is recorded in beta readiness docs rather than committed here. A true global `npm install -g` smoke remains optional if global install verification is requested.

### 2026-05-31 - README And Code Standards Refresh

- Author/agent: Gaille Amolong / Codex
- Summary: refreshed the root README to match the current alpha.2/pre-beta state after session-reset benchmark, restore-path golden, mismatch exit classification, and metadata-alignment work. Added architecture standards for functional core/imperative shell, purposeful same-shape transforms, boundary error classification, and clear non-acronym-heavy naming.
- Checks run: documentation review only before storage refactor.
- Risks/follow-ups: no runtime behavior changed. Future beta code changes should apply the standards incrementally instead of broad cosmetic churn.

### 2026-05-31 - Storage Repository Ownership Split

- Author/agent: Gaille Amolong / Codex
- Summary: split the oversized aggregate storage repository into table-family ownership directories for project setup, sessions, context artifacts, context ledgers, evidence, claims, proofs, compression, and indexing. Kept `src/core/storage/repositories.ts` as the shared type and aggregate factory surface so callers continue importing through the storage barrel.
- Checks run: `npm run typecheck`; `npm run storage:check`; `npm run docs:check`; `npm run architecture:check`; behavior suite via storage/durable-context commands; `npm run check`.
- Risks/follow-ups: no schema or repository behavior changes are intended. Future storage table families should start in their own ownership subdirectory rather than returning to a flat storage folder.

### 2026-05-31 - Alpha.3 Release Prep

- Author/agent: Gaille Amolong / Codex
- Summary: bumped package metadata to `0.1.0-alpha.3` and refreshed README, roadmap, changelog, agent-session docs, beta-readiness/status docs, and implementation-facing changelog for the alpha.3 hardening candidate.
- Checks run: user-provided `npm version 0.1.0-alpha.3 --no-git-tag-version`; `npm run check`; `npm run benchmark:run`; `npm run e2e:alpha`; follow-up `npm run docs:check`.
- Risks/follow-ups: npm publish, Git tag creation, release creation, dist-tag changes, external benchmark workspace alpha.3 alignment, and global install smoke remain approval-gated.

### 2026-05-31 - Alpha.3 Package Publish Hygiene

- Author/agent: Gaille Amolong / Codex
- Summary: after the first publish attempt failed because the active npm auth could not publish `grape-context`, added a prebuild dist cleanup and package dry-run assertions so moved storage repository files cannot leave stale compiled JavaScript in the release tarball. Also aligned the package bin path with npm's normalized package metadata.
- Checks run: failed `npm publish --tag alpha`; `npm whoami`; `npm view grape-context version dist-tags --json`; `npm run package:check`; `npm run docs:check`; `npm run install:check`.
- Risks/follow-ups: npm publish still requires an authenticated account/token with package publish permission.

### 2026-06-01 - Post-Publish Beta Gate Hardening

- Author/agent: Gaille Amolong / Codex
- Summary: verified the live `grape-context@0.1.0-alpha.3` npm dist-tags and GitHub tag/release state, refreshed beta-readiness/status docs from that deployed state, added `npm run beta:check` as the combined local beta gate, added `npm run global:smoke` for the registry-installed global package, and hardened packaged install smoke to prove CLI omitted restore, task/session mismatch recovery, and reset recovery in the installed consumer-repo path.
- Checks run: live `npm view grape-context version dist-tags time --json`; live `git ls-remote --tags origin`; live `gh release view v0.1.0-alpha.3`; `npm install -g grape-context@0.1.0-alpha.3`; `npm run global:smoke`; external `npm install grape-context@0.1.0-alpha.3 --ignore-scripts --audit=false --fund=false`; external `GRAPE_BIN=.../node_modules/.bin/grape node smoke-published.mjs` passed 8/8; focused `npm run install:check`; full `npm run beta:check`.
- Risks/follow-ups: real clean-repo MCP client trials still need to prove the workflow beyond scripted smoke before beta sign-off.

### 2026-06-01 - Grape-Observed Local Runner

- Author/agent: Gaille Amolong / Codex
- Summary: added `grape run` and `grape test` as the first local Grape-observed command/test runner path. The commands execute from the repository root against an existing current context session, reject secret-looking command text before execution, create Grape observed run IDs, and persist trusted redacted `command_run` / `test_run` source evidence with command/output hashes, exit status, timestamps, branch/commit/worktree/session scope, and no raw command/stdout/stderr bodies.
- Checks run: `npm run typecheck`; `npm run docs:check`; `npm run build:test`; focused `tests/behavior/cli-local-project.test.mjs`; full `npm run beta:check`.
- Risks/follow-ups: this initial runner slice did not promote durable truth until the follow-up observed-run result proof/claim slice. Broader claim types, parsed durable rules, behavior/correctness claims, and conflict creation/resolution remain pending.

### 2026-06-01 - Observed Run Result Proofs And Claims

- Author/agent: Gaille Amolong / Codex
- Summary: added the narrow `grape_observed_run_result` proof and claim path for trusted local `grape run` / `grape test` executions. The runner now writes the source row, validates observed-run metadata, persists a direct proof row, creates a claim candidate, persists a verified durable result claim, and links the proof to the claim in one transaction. MCP command/test writes remain temporary and cannot mint observed-run authority.
- Checks run: `npm run typecheck`; `npm run build:test`; focused `tests/behavior/observed-run-claim-store.test.mjs`; focused `tests/behavior/cli-local-project.test.mjs`; focused `tests/behavior/mcp-stdio.test.mjs`.
- Risks/follow-ups: the observed-run claim proves only the command/test result Grape observed. Broader behavior, correctness, root-cause, durable rule, and conflict workflows remain pending.

### 2026-06-01 - Retrieval Contract And TypeScript Symbol Signal

- Author/agent: Gaille Amolong / Codex
- Summary: documented the current retrieval contract and beta boundary, then improved the lightweight TypeScript/JavaScript symbol signal so const-assigned arrow/function declarations are indexed as function symbols for task source retrieval and exact excerpt anchoring.
- Checks run: focused `tests/behavior/file-index.test.mjs`; `npm run typecheck`; `npm run docs:check`.
- Risks/follow-ups: retrieval is still lightweight. Full AST-backed language extraction, complete call graphs, semantic ranking, broader durable-claim retrieval, and richer test/source exact-span ranking remain pending.

### 2026-06-01 - Beta Trial Checklist And Durable Workflow Exclusions

- Author/agent: Gaille Amolong / Codex
- Summary: added a dedicated beta trial checklist for real MCP client trials across install, setup, first/second context turns, restore, stale source recovery, branch switch recovery, reset recovery, and Grape-observed command/test evidence. The checklist now requires trial notes to confirm that broader observed-run behavior claims, broader claim types, parsed rules, conflict workflows, and full graph/semantic retrieval are excluded from the beta transport promise.
- Checks run: `npm run docs:check`.
- Risks/follow-ups: this does not implement broader durable workflows. It makes the beta gate explicit so those gaps cannot be accidentally marketed as complete.

### 2026-06-01 - Local Observation Module Split

- Author/agent: Gaille Amolong / Codex
- Summary: split the local command/test observation recording path out of the near-checkpoint `observations.ts` file. The public import surface remains `src/app/local-project/observations.ts`, while `observation/` now owns public types, validation/normalization, source construction, repo-relative path handling, and persistence orchestration separately.
- Checks run: `npm run typecheck`; focused local-project CLI behavior test; `npm run docs:check`; `npm run architecture:check`; `npm run beta:check`.
- Risks/follow-ups: this is a structural refactor only. `compile.ts`, `candidates.ts`, `types.ts`, and `config.ts` remain near the 300-line review checkpoint and should be split before adding unrelated responsibilities.

### 2026-06-01 - Local Project Workflow Directory Split

- Author/agent: Gaille Amolong / Codex
- Summary: reorganized `src/app/local-project/` into workflow-owned subdirectories. Setup/bootstrap/status/doctor/sync code now lives in `setup/`; compile/session/compression/task-retrieval code lives in `context/`; read-only artifact/claim/proof/rule/session/stale/conflict services live in `inspection/`; omitted restore code lives in `omission/`; restricted write code lives in `writes/`; observed command/test runner code lives under `observation/`; and public local-project contract interfaces are split under `types/` with root files kept as narrow export surfaces.
- Checks run: `npm run typecheck`; `npm run docs:check`; `npm run architecture:check`; `npm run build:test`; focused local-project/MCP/compression/observed-run behavior tests; `npm run beta:check`.
- Risks/follow-ups: this is a structural refactor only. `compile.ts` and `candidates.ts` remain near the 300-line review checkpoint and should be split before adding unrelated responsibilities.

### 2026-06-01 - Project Rule Conflict Creation And Manual Resolution

- Author/agent: Gaille Amolong / Codex
- Summary: added conservative parsed-project-rule conflict creation and manual CLI resolution. Local compile now creates deterministic `needs_review` claim edges when verified `project_rule` claims contain opposing rule language over the same normalized topic. `grape conflicts` lists open conflict edges, while `grape conflicts --resolve <edge> --as coexists_with|variant_of` records a non-conflict resolution edge so the conflict no longer appears as open. MCP conflict access remains read-only.
- Checks run: `npm run typecheck`; `npm run build:test`; focused `tests/behavior/claim-conflicts.test.mjs tests/behavior/cli-local-project.test.mjs tests/behavior/mcp-stdio.test.mjs`; `npm run docs:check`; `npm run architecture:check`; full `npm run check`.
- Risks/follow-ups: this is not automatic contradiction judgment or rule precedence. It only creates review edges for obvious deterministic text conflicts and records manual local resolution; broader claim conflicts, automatic resolution, nested rule scope, and behavior/root-cause claims remain pending.

### 2026-06-03 - Beta Token Transport Hardening

- Author/agent: Gaille Amolong / Codex
- Summary: compacted default MCP `grape_get_context` transport for beta token-efficiency proof. The default output uses `agent_pack` with compact pack scopes, artifact refs, and short MCP text summaries. Later hardening removed inline Markdown and experimental graph adjacency from this default compact response; full embedded artifacts remain available through `outputMode: "full"` or `grape_get_artifact`, while inline Markdown and graph adjacency remain available through `outputMode: "full"`. Benchmarks estimate serialized default agent-output tokens and fail the stable fixture when first-turn agent-output overhead exceeds 400 percent.
- Checks run: `npm run build:test`; focused MCP/context-artifact/benchmark behavior tests; `npm run benchmark:run`.
- Risks/follow-ups: serialized output overhead is now measured and gated but still materially higher than logical body tokens. Further savings should target restore/invalidation row compacting and first-turn metadata density without weakening restore or invalidation safety.

### 2026-06-03 - Beta Pipeline Performance Hardening

- Author/agent: Gaille Amolong / Codex
- Summary: hardened local compile performance without changing V1 transport semantics. Compile/init/write-session flows now pass the already-captured immutable repo snapshot into persistence, snapshot persistence skips repeat evidence/index materialization only when expected rows already exist, storage exposes scoped sent-ledger and invalidation-ref queries, lexical search uses bounded SQL prefiltering before the existing normalized matcher fallback, and migration `0005_context_performance_indexes.sql` adds supporting lookup indexes. Artifact file writes now use temp-file then rename materialization to reduce partial-file risk while preserving durable send rollback semantics.
- Checks run: `npm run build:test`; focused snapshot/index/storage/durable/compression behavior tests.
- Risks/follow-ups: artifact writes intentionally still happen before the durable send transaction returns, because moving them fully after commit can mark context as sent before local output exists. A future staged materialization design should solve that without weakening session-ledger correctness.

### 2026-06-03 - Language-Agnostic Retrieval Boundary

- Author/agent: Gaille Amolong / Codex
- Summary: documented the language-provider capability model for polyglot and monorepo repos. Grape's transport remains language-agnostic, while language-aware graph extraction is provider-scoped orientation only. Unsupported languages and unknown package/workspace boundaries must fall back to safe exact/path/lexical context with explicit blind spots.
- Checks run: `npm run check` (pass, behavior suite included).
- Risks/follow-ups: per-language providers, package/workspace detection, polyglot fixtures, monorepo fixtures, and package-scoped invalidation tests remain implementation work before broad polyglot/monorepo beta claims.

### 2026-06-03 - Documentation Consistency Audit

- Author/agent: Gaille Amolong / Codex
- Summary: audited root and V1 docs for stale graph/language/beta wording, then aligned README, roadmap, changelog, CLI/MCP contracts, fixtures, examples, beta trial checklist, and SPEC around graph-shaped context, safe Kotlin/Java/Python/etc. fallback, and provider/fixture requirements before stronger polyglot or monorepo claims.
- Checks run: `npm run check` (pass, behavior suite included) and a markdown relative-link scan (pass, 55 markdown files).
- Risks/follow-ups: this is documentation alignment only. Provider dispatch, package/workspace detection, and polyglot/monorepo fixtures still need implementation and behavior coverage.

### 2026-06-04 - Documentation Simplification Audit

- Author/agent: Gaille Amolong / Codex
- Summary: audited docs and TypeScript reachability for unused or confusing surfaces. Simplified current CLI examples so runnable code blocks only show implemented beta transport commands, preserved deferred decision/export/purge/claim-linked proof commands as still-planned V1.0 surfaces, and aligned runtime/beta-readiness wording with the Node.js 22.13+ package floor and latest behavior-test count.
- Checks run: `npm run check` (pass, behavior suite included), `npm run docs:check` after final wording updates, `npm run architecture:check`, strict TypeScript unused-symbol audit, markdown relative-link scan (pass, 55 markdown files), and a TypeScript reachability audit.
- Risks/follow-ups: empty `src/core/scope/` and `src/core/sessions/` ownership placeholders remain intentional because architecture docs and import-boundary rules reserve those module boundaries for future scope/session implementations.

### 2026-06-04 - Beta Release Contract Hardening

- Author/agent: Gaille Amolong / Codex
- Summary: hardened the beta release contract around privacy, current-valid truth, and compact MCP transport. Repo-scoped CLI and benchmark output now sanitize against the active repo root and common local path aliases. Current-valid retrieval now excludes claims blocked by explicit active `contradicts`, `violates`, and `supersedes` edges while keeping `needs_review` as inspection metadata. `grape_get_artifact` defaults to metadata and returns stored public artifact JSON only through explicit `outputMode: "full"` / `artifactRef.fullArtifactTool`. GitHub Actions now runs the full `beta:check` gate.
- Checks run: `npm run build:test`; `npm run docs:check`; focused CLI privacy, claim-conflict, and MCP stdio behavior tests; `npm run beta:check` (pass, 199/199 behavior tests plus benchmark suite and alpha e2e smoke).
- Risks/follow-ups: this does not add broad durable memory, automatic conflict resolution, root-cause/correctness claims, semantic retrieval, or real Composer/Graphify/Grape benchmark results. Those remain explicit beta/1.0 validation work.
