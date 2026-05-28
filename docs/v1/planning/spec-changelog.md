# V1 Spec Changelog

This file records changes to the V1 implementation contract.

Each entry should include:

- date
- changed section
- reason
- affected docs
- affected tests
- migration or benchmark impact, if any

## Unreleased

- Established public V1 documentation architecture derived from the canonical V1 contract.
- Published the canonical V1 implementation contract as `docs/v1/SPEC.md` so future implementation does not depend on ignored planning files.
- Clarified implementation planning around goal names: Documentation Foundation, In-Memory Context Loop, and Alpha Product Slice.
- Hardened supporting domain docs with schemas, transition gates, storage rules, MCP contracts, compression invalidation, tests, benchmark rules, and security gates derived from `SPEC.md`.
- Organized supporting docs into purpose-based folders while keeping `docs/v1/SPEC.md` as the canonical top-level contract.
- Added In-Memory Context Loop plan to constrain the first implementation loop.
- Aligned supporting storage table names with canonical `SPEC.md` names where present.
- Added the first alpha storage migration contract for project, repo, source, claim, proof, artifact, and session-ledger tables.
- Hardened the alpha storage contract with SQL checksum validation, serialized-state constraints, session branch/worktree identity, dependency manifest hashes, and complete sent/omitted ledger fields.
- Selected Node 22.5+ built-in `node:sqlite` for the initial runtime migration path to avoid native SQLite package installation.
- Made Node 22.5+ the canonical V1 runtime and added ADR-0004 for the no-native SQLite runtime decision.
- Tightened the storage contract so sent, omitted, and pack ledger rows must reference artifacts owned by the same session.
- Tightened restorable omission storage so restore metadata, branch/commit identity, dependency manifest hash, send count, and token count are persisted.
- Added runtime migration bootstrap protection for non-empty databases without trusted migration metadata.
- Added Durable Context Build Proof as the next implementation goal before CLI/MCP product transport.
- Added code modularity standards with split checkpoints to prevent godfiles and generic utility modules.
- Extended storage dependency kinds for persisted artifact manifests that include repo snapshot, worktree state, and session ledger dependencies.
- Extended the repo snapshot implementation contract with dirty paths, deterministic snapshot hashes, Git-visible file hashing, ignored-file exclusion, and symlink hashing without following symlink targets.
- Clarified the implementation contract for snapshot-derived evidence storage: allowed files become source records, rejected ignored/private/unreadable paths become source-rejection records, and rejected file contents remain unread.
- Added an explicit implementation need for `symbol_nodes` and `symbol_edges` through `0002_indexing_foundation.sql` so V1 has persisted file relationship tracking before repository-derived artifact compilation.
- Clarified the current repository-derived compiler foundation as an in-memory artifact scaffold that consumes persisted snapshot/source/index records without claiming final V1 artifact output.
- Clarified the initial CLI compile scaffold output path. Later slices changed public JSON to a V1 `ContextArtifact` projection while keeping internal scaffold sidecars for restore verification.
- Clarified the first MCP stdio implementation status: `grape_get_context` and `grape_get_status` are implemented against the scaffold compile/status services while the full V1 MCP tool surface and final artifact schema remain pending. The current MCP context tool requires `sessionId` or `agentSessionId` and returns repo-relative artifact file refs. Later slices added seed-aware source retrieval and token-budget evaluation.
- Clarified the omitted restore scaffold contract: CLI `grape omitted` and MCP `grape_get_omitted_item` restore only session-scoped omitted scaffold sections after validating token ownership, stored artifact identity, artifact hash, stored dependency rows, section hash, dependency manifest, redaction status, branch, commit, worktree hash, and source/config/lockfile/rule dependency hashes.
- Clarified scaffold artifact inspection: CLI `grape artifacts` and MCP `grape_get_artifact` expose metadata and dependency rows for inspectability while keeping the final V1 artifact schema explicitly pending.
- Clarified branch-switch session behavior for the scaffold product slice: explicit session reuse across Git branches updates the session compile state under lock, records a `branch_changed` session invalidation event, and invalidates stale sent context instead of treating previous-branch context as unchanged.
- Clarified exact-source scaffold evidence: repository-derived artifacts may include bounded exact excerpts from selected allowed sources with deterministic proof refs and proof dependency hashes, but these refs do not promote durable claims or satisfy high-risk task policies by themselves.
- Clarified session reset recovery for the scaffold product slice: explicit reset requests invalidate active prior sent context and force current sections to be resent instead of relying on omitted unchanged context.
- Clarified active rule handling for the scaffold product slice: trusted rule files can be rendered as pinned exact-context sections before parsed durable project-rule records exist.
- Clarified FTS storage foundation behavior: lexical FTS rows may be persisted for allowed source records only after source-hash verification and secret-looking text rejection.
- Clarified the scaffold-to-V1 boundary: internal scaffold diff rows can remain an implementation detail when public CLI/MCP/artifact JSON output is mapped to V1-shaped `ContextPackItem` objects.
- Clarified task source retrieval behavior for the scaffold product slice: safe FTS rows, symbol/path metadata, and MCP seed refs may prioritize source evidence selection, but they do not replace durable current-valid claim retrieval or final high-risk exact-span policy.
- Clarified token-budget behavior for the scaffold product slice: requested budgets are evaluated without pruning required context, and budgets below pinned/exact/invalidation context fail closed with `token_budget_below_required_context`.
- Clarified the public artifact schema bridge: compile outputs now expose a V1 `ContextArtifact` projection in public JSON and MCP output, while internal `InMemoryContextArtifactShape` scaffold bodies are stored in `.scaffold.json` sidecars for restore verification only.
- Clarified schema gaps in `ContextInput`, `ContextDependency`, and `ContextArtifact`: repo snapshot, worktree state, and session ledger dependencies are valid invalidation inputs, and `tokenBudget` is optional when no budget was requested.
- Clarified proof inspection during the pre-claim scaffold phase: `grape proofs`, `grape proofs --proof <proof_id>`, and `grape proofs --source <source_id>` are valid inspection commands alongside the future claim-linked `grape proofs <claim_id>` form.
- Clarified the first high-risk exact-context policy: scaffold risk overlays are safe only when task retrieval or explicit seed refs select proof-backed exact source/config/rule evidence; otherwise compile fails closed with `risk_overlay_missing_exact_context`.
- Clarified the first durable claim type: `repository_source_excerpt_exists` may be promoted from a validated direct exact-source proof and inspected through `grape claims --active` / `grape_get_claims`, but it proves only excerpt existence and is not yet the primary artifact retrieval input.
- Clarified artifact behavior for first durable claims: active `repository_source_excerpt_exists` claims may be rendered in a `current-valid-claims` artifact section with claim/proof dependencies, while broader durable claim retrieval remains pending.
- Clarified the first compression cache behavior: deterministic `symbol_outline` artifacts are derived cache with stored input hashes and artifact dependencies, may render as orientation, and cannot provide proof or replace high-risk exact context.
- Clarified rule digest compression behavior: deterministic `rule_digest` artifacts are derived from verified active rule excerpt proofs and may provide orientation only; they do not replace pinned exact rule text or act as proof.
- Clarified context pack summary compression behavior: deterministic `context_pack_summary` artifacts are derived from session-scoped sent ledger rows after durable pack persistence, exclude invalidated/compression/other-branch rows, and are cached without artifact rendering until finer-grained compression invalidation is implemented.
- Clarified the session inspection surface: `grape sessions` is implemented as a read-only CLI debug command over context session and diff ledger metadata.
- Clarified the stale inspection surface: `grape stale` is implemented as a read-only CLI debug command over emitted `INVALIDATE_PREVIOUS` pack ledger rows, not as predictive stale analysis.
- Clarified the MCP stale inspection surface: `grape_get_stale_items` exposes the same emitted invalidation metadata without `rootPath` or context bodies.
- Clarified the MCP rules inspection surface: `grape_get_rules` exposes current Git-visible rule excerpts after source-hash verification and artifact secret scanning, without parsed durable `project_rules` or absolute local root paths.
- Clarified the first restricted MCP write behavior: `grape_record_command_result` and `grape_record_test_result` store agent-reported command/test observations as temporary source evidence with hashes only, require an existing current context session, reject MCP-minted observed-run authority, and do not promote durable claims.
- Clarified the remaining restricted MCP write behavior: `grape_record_candidate`, `grape_record_user_decision`, and `grape_request_user_confirmation` are implemented as non-promoting temporary evidence/request surfaces. Candidate writes link to `claim_candidates` with proof-required rejection metadata, user-decision writes store prompt/response hashes only, and confirmation requests return request IDs without persisting durable truth.
- Clarified the conflict inspection surface: `grape conflicts` and `grape_get_conflicts` inspect existing conflict-like `claim_edges` rows without claiming contradiction detection or automatic resolution.
- Clarified V1 recovery guidance behavior: status, doctor, context compile, stale restore, lock-conflict, and privacy/redaction failure paths return actionable next steps without exposing private file contents or secrets.
- Clarified partial-bootstrap config recovery: malformed or schema/project-identity-incomplete local `.grape/config.json` files are repairable by backing up the old file and writing a fresh local config, while unsupported schema versions fail closed.
- Clarified compiler source-tree ownership: `src/core/compiler/` is split into artifact, pack, repository, repository section, and repository policy subdirectories, with `src/core/compiler/index.ts` remaining the public export boundary.
- Clarified the first benchmark harness contract: `grape bench --fixture <name>` uses a named copied fixture repo, runs the real local compile/diff path twice, and fails threshold checks on unsafe omission, stale sends, missing no-change omission, missing restore hints, or low second-turn token reduction.
- Clarified context-pack Markdown output: JSON remains the canonical machine contract, while Markdown must render enough structured artifact, diff, dependency, restore, token, and safety metadata for human and agent inspection.
- Clarified bootstrap detection implementation boundaries: setup may report manifest/config-derived project hints and candidate rules, but candidate rules are not durable decisions and raw script bodies are not exposed.
- Clarified compiler repository ownership: dependency manifests, proof refs, integrity validation, rendering contracts, and selection logic live in focused compiler subdirectories under `src/core/compiler/repository/` while the public export boundary remains `src/core/compiler/index.ts`.
- Clarified repo scanner safety behavior: oversized and binary-looking files are rejected before source evidence ingestion, persisted as source rejections with metadata hashes/sizes only, and summarized through setup/status scan diagnostics.
- Clarified Git snapshot module ownership: Git orchestration remains in `repo-snapshot.ts`, while file manifest hashing, source-kind classification, and scanner rejection policy live in `file-manifest.ts`.
- Clarified cross-platform indexing path behavior: file-index path helpers normalize separators and reject traversal or drive-qualified repo paths before file reads.
- Clarified Git source-scope behavior: allowed source evidence now distinguishes committed, staged, unstaged, and untracked files using Git porcelain status.
- Clarified compiler section ownership: `sections/` assembles repository-derived artifact sections and `sections/builders/` owns individual section families.
- Clarified CLI fallback behavior: `grape sync` refreshes local snapshot/evidence/index inputs without context output, and `grape diff-context --task <text>` names the explicit compile-plus-session-diff path.
- Clarified privacy doctor behavior: `grape doctor --privacy` is a diagnostic-only command and does not approve private reads, export data, purge data, or reveal rejected-file contents.
- Clarified token-budget pruning behavior: budgeted compile protects task, pinned, exact/safety-critical, omission/restore, and invalidation context; optional non-safety context may be omitted from public pack items and output sections with explicit `omittedDueToBudget` metadata.
