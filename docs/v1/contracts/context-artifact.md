# V1 Context Artifact

## Purpose

Define the central product object produced by Grape V1.

## Source Of Truth

This document is the implementation-facing extraction of the artifact contract in `docs/v1/SPEC.md`.

## Update Triggers

- artifact field changes
- section type changes
- dependency manifest changes
- serialized output changes

## Agent Checks

Before editing artifact behavior, agents must verify:

- every artifact has a dependency manifest
- every section has input refs and content hash
- high-risk required context is exact, not summary-only
- artifact output passes secret scan before storage or return

## Canonical And In-Memory Schemas

Canonical V1 artifact schemas live in `docs/v1/SPEC.md` sections 25.1 and 25.2. The current implementation keeps narrower internal repository artifact types for section hashing, dependency validation, and restore verification, then emits the public V1 `ContextArtifact` JSON shape for CLI/MCP consumers.

**Reviewer warning:** a public `ContextArtifact` JSON file is not, by itself, evidence that Grape has promoted broad durable claims or verified runtime behavior. Inspect dependency refs, proof refs, `compileMode`, `unsafeReasons`, and `missingContext` before trusting an artifact. Internal `.repository.json` backing files exist only for restore verification.

```ts
interface InMemoryContextRequest {
  taskId: string;
  sessionId: string;
  repoId: string;
  branch: string;
  commit: string;
  worktreeHash: string;
  environmentScope?: EnvironmentScope;
  packageRoot?: string;
  serviceRoot?: string;
  featureFlagCount?: number;
  featureFlagScopeHash?: string;
  taskType: TaskType;
  riskOverlays: RiskOverlay[];
  userRequestHash: string;
}

interface InMemoryContextSectionShape {
  id: string;
  type:
    | "task"
    | "pinned_rule"
    | "active_claim"
    | "code_span"
    | "test_span"
    | "config_span"
    | "risk_warning"
    | "stale_warning"
    | "contradiction"
    | "compression_orientation"
    | "omission_notice";
  title: string;
  body: string;
  sourceRefs: string[];
  proofRefs: string[];
  dependencyRefs: string[];
  contentHash: string;
  pinned: boolean;
  exactRequired: boolean;
  redactionStatus: "clean" | "redacted" | "blocked";
}

interface InMemoryContextDependencyShape {
  id: string;
  kind:
    | "repo_snapshot"
    | "worktree_state"
    | "source"
    | "source_file"
    | "config"
    | "lockfile"
    | "proof"
    | "claim"
    | "rule"
    | "symbol"
    | "test"
    | "compression_artifact"
    | "session_ledger";
  ref: string;
  hash: string;
  scope: Record<string, unknown>;
}

interface InMemoryContextDependencyManifestShape {
  manifestId: string;
  dependencies: InMemoryContextDependencyShape[];
  createdAt: string;
  hashAlgorithm: "sha256";
  manifestHash: string;
}

interface InMemoryContextPackItemShape {
  itemId: string;
  artifactId: string;
  sessionId: string;
  sectionId: string;
  state: DiffState;
  title: string;
  body: string;
  contentHash: string;
  previousItemId?: string;
  restoreToken?: string;
  safeOmissionReason?: "unchanged_restorable";
  pinned: boolean;
  warnings: string[];
}

interface InMemoryContextArtifactShape {
  artifactId: string;
  input: InMemoryContextRequest;
  sections: InMemoryContextSectionShape[];
  dependencyManifest: InMemoryContextDependencyManifestShape;
  warnings: string[];
  unsafeReasons: string[];
  createdAt: string;
  artifactHash: string;
}
```

Current CLI, artifact JSON, and MCP `outputMode: "full"` output map internal diff rows to the V1 `ContextPackItem` output shape before returning them to agents. The emitted item fields are `id`, `state`, `itemKind`, `itemRef`, optional `sectionId`, `title`, `content`, `contentHash`, `tokenCount`, `pinned`, `safetyCritical`, optional `invalidatesSentItemId`, optional `restoreId`, `inputRefs`, and `warnings`. Default MCP `outputMode: "agent_pack"` returns compact preview items instead: it omits `content`, includes `contentPreview` and `contentOmitted: true`, and keeps `contentHash`/`tokenCount` pointing at the full stored body.

Public `.grape/artifacts/ctx_<id>.json` files now include:

- `artifactFormat: "grape.context-pack.v1"`
- `artifactFormatVersion: 1`
- `contextArtifact`, a V1 `ContextArtifact` projection with output sections, dependency manifest, compile mode, confidence fields, token fields, current branch/worktree identity, and normalized `currentScope`
- `contextPackItems`
- `omittedItems`
- `tokenMetric`
- `budget`

The internal repository artifact backing file is written separately to `.grape/artifacts/ctx_<id>.repository.json` for omitted-item restore verification. That backing file is an implementation detail, not the public agent contract.

## Minimum Artifact Rule

A final V1 context artifact is invalid unless it is:

- task-specific
- branch/worktree-aware
- proof-backed where claims are durable
- dependency-tracked
- diffable
- inspectable
- invalidatable
- redaction-scanned

Internal repository artifact shapes are not separate public schemas. They are valid only as implementation-local structures used for hashing, dependency validation, diffing, and restore verification; public CLI/MCP output must remain the V1 `ContextArtifact` and `ContextPackItem` contract.

## Current Repository-Derived Compiler Foundation

The current compiler foundation can build an `InMemoryContextArtifactShape` from persisted repo inputs:

- repo snapshot and worktree state records
- snapshot-derived source records
- persisted AST-backed symbol nodes and relationship edges

It emits task, repository-state, allowed-source-manifest, active-project-rules when trusted rule files exist, exact-source-evidence, file-relationship, and index-confidence sections. Its dependency manifest includes repo snapshot, worktree state, selected source/config/lockfile/rule records, selected exact source proof refs, and selected symbol relationships. Aggregate source/index sections retain repo snapshot and worktree dependencies so empty or all-unindexed repositories still produce inspectable partial context. Relationship summaries render repository paths when known, with symbol IDs kept as supporting identities.

The repository artifact compiler emits a task-retrieval section when task terms, seed refs, source anchors, relationship evidence, or retrieval warnings exist. The local compile service searches safe lexical rows and symbol/path metadata for the current snapshot, merges those matches with explicit seed file refs and path-like test seed refs, includes related test files that import or call already-selected source files, and passes selected source refs into the compiler. Selected refs are prioritized in source manifests, dependency manifests, symbol summaries, and bounded exact-source evidence. When selected refs exist, bounded exact-source proof creation stays scoped to those refs plus pinned rule files instead of filling unused proof slots with unrelated repository files. If retrieval selects no refs, Grape may still emit bounded generic exact-source evidence so the artifact remains inspectable. Path-like test seeds are rendered separately as test seed refs so agents can see why a test file was included. Graph-related refs and related tests are rendered separately, and related test relationships render the specific import/call edge used for selection. When the selected relationship has an indexed symbol edge ref, the task-retrieval section includes that relationship ref and depends on the matching symbol-edge dependency. Non-path test names remain retrieval terms only. Exact-source excerpt windows prefer task-selected symbol line anchors when available and can include up to two non-overlapping windows per selected source. Query-term windows are used only when no symbol anchors exist for that source, then the compiler records the resulting start/end lines and excerpt hash as proof dependencies. This improves task specificity without treating lexical hits, AST graph facts, test imports, related test relationships, relationship refs, or test file presence as durable proof of behavior, coverage, execution, or correctness.

The active-project-rules section is pinned. It is compiled from trusted `rule_file` source excerpts after the same source-hash verification used by exact-source-evidence. This gives agents exact, dependency-tracked local rule text. Compile may also promote parsed `project_rule` claims from safe verified rule-file lines, but the exact pinned rule excerpt remains the authority.

The exact-source-evidence section is a proof foundation: it reads only already-allowed non-rule source records, verifies the current file/symlink bytes still match the stored source hash, selects one or two bounded non-overlapping excerpts, records deterministic proof refs, stores excerpt hashes as proof dependencies, and includes the exact excerpts in the artifact. This proves that each excerpt exists in the current source input. It does not promote durable claims or prove runtime behavior.

Local compile also resolves current-valid durable claims and renders a `current-valid-claims` `active_claim` section titled `Scoped Proof-Backed Claims (Current-Valid)` when verified narrow claims are active for the current branch, commit, source hash, proof hash, and task-selected source refs. The section footer states that claims are proof-backed under narrow policy for the current compile scope and do not prove correctness, root cause, fix validity, semantic authority, or benchmark savings. If task retrieval selects refs, unrelated active claims from the same branch/commit are omitted from the artifact even though they remain inspectable through `grape claims --active` and MCP `grape_get_claims`; current project-rule claims remain eligible, package manifest dependency claims render only for matching package-root tasks or selected manifests, and current-session observed test-run result claims render only when explicit safe `testFiles` metadata names a selected test ref. The section includes claim refs, proof refs, source refs, and claim/proof dependency rows. Current active claim types are `repository_source_excerpt_exists`, `repository_symbol_declaration_exists`, `package_manifest_dependency_exists`, `project_rule`, `observed_test_failure_span_link`, and, when produced by the trusted local runner, `grape_observed_run_result`. Package manifest dependency claim text is limited to `Manifest declares dependency <dependency-name>.` and does not expose raw dependency specifiers. Observed failure-span-link claim text is limited to `This test was observed failing and is linked to these candidate source/test spans.` plus an explicit no-causality disclaimer; it does not expose raw failure logs. Broader behavior, decision, conflict, dependency-use, install-state, and correctness claims remain pending.

Local compile now persists deterministic `symbol_outline`, `rule_digest`, and `context_pack_summary` compression artifacts. Symbol/rule artifacts are built before compilation from the lightweight symbol index and verified active rule excerpts. When prior sent context exists for the same session, branch, and head commit, local compile first builds a base artifact with current exact dependencies, filters the prior sent ledger through the same stale-dependency rules used by durable diffing, and only then rebuilds a current `context_pack_summary` from active non-compression sent rows. These artifacts render as `compression-orientation`. The public V1 `ContextArtifact` includes `compressionArtifactRefs`, `compressionArtifactsUsed`, and `compression_artifact` dependency refs for compression artifacts that are actually rendered. The compression section is non-proof orientation only; it has no proof refs and cannot satisfy exact-required or high-risk context. Exact rule text still lives in the pinned active-project-rules section; the rule digest carries only rule refs, line spans, proof refs, and hashes. The context pack summary carries prior sent item IDs, states, hashes, timestamps, and token counts, not freeform model memory, and it must not include rows the current compile is about to invalidate.

`grape compile --task <text>` now writes an inspectable V1 context-pack JSON and Markdown under `.grape/artifacts/ctx_<id>.json` and `.grape/artifacts/ctx_<id>.md`, after a basic artifact-level secret scan. The public JSON contains the V1 `ContextArtifact` plus the diffed `ContextPackItem[]`; the Markdown renders the same structured contract with an artifact summary, diff-state counts, pack item metadata/input refs, omitted/restore metadata, output section metadata, dependency manifest details, token metrics, budget status when requested, and warnings/safety fields. Public `contextArtifact.currentScope` carries branch, commit, worktree hash, dirty-worktree status, task/session IDs, environment label, package/service root when known, selected source refs, warning labels, and feature-flag count/hash only. It must not render raw environment variables, feature flag labels or values, dirty file contents, or absolute local paths. The internal repository backing file remains available only so restore can verify section hashes against the original compiled sections. The artifact ID identifies a compile output instance; the artifact hash is the deterministic repository artifact content identity and excludes `createdAt` and instance IDs.

When `--token-budget` or MCP `tokenBudget` is supplied, the durable pack builder applies budget policy before context pack rows are persisted. Required context means the task summary, pinned rules, exact/safety-critical sections, unchanged omission/restore metadata, and invalidation items. Required context is never pruned. If required context is larger than the requested budget, output is marked unsafe with `token_budget_below_required_context`. If required context fits but optional context does not, Grape prunes optional non-safety sections from the public `contextPackItems` and public `contextArtifact.outputSections`, records them in `contextArtifact.omittedDueToBudget` and `budget.omittedDueToBudget`, and returns `token_budget_pruned_optional_context`. Budget-pruned items are not treated as sent or restoreable; callers should rerun with a larger budget if they need those optional bodies.

Risk overlays now require task-selected exact source/config/rule evidence. If task retrieval selects at least one allowed source and the compiler can validate a proof-backed exact excerpt for that source, the high-risk compile may proceed as `partial_with_risk` or `safe_minimum` depending on other warnings. If no task-selected exact excerpt exists, the artifact is unsafe with `risk_overlay_missing_exact_context`.

`grape artifacts --artifact <id>` and MCP `grape_get_artifact` expose stored artifact metadata, dependency rows, and repo-relative public artifact file refs for inspection. They do not return internal repository backing files and do not promote summaries to proof.

Agent-authored artifact annotations are explicitly deferred from V1 rendered artifacts. Restricted MCP write tools may record temporary evidence, candidates, hashes, and confirmation request metadata, but those records do not mutate an artifact body or become current-valid context unless a future Trust Kernel flow validates proof and scope. See `docs/v1/decisions/adr-0008-agent-artifact-annotations.md`.

This is still narrower than the final broad durable-claim retrieval system. It uses the V1 `ContextArtifact` JSON envelope, enforces the first task-specific high-risk exact-span policy, can render current-valid narrow source-excerpt, symbol-declaration, project-rule, and observed-run result claims, and includes deterministic symbol/rule/context-pack compression cache orientation. Broader durable claim types and richer compression replacement policy are not yet promoted.

## Section Rules

- `pinned_rule`, `risk_warning`, `stale_warning`, `contradiction`, and high-risk exact sections must not be replaced by compression.
- High-risk overlays require exact code/config/rule spans for required context. Bounded repository excerpts satisfy the current high-risk policy only when they are selected by task retrieval or explicit seed refs and have proof dependencies.
- A section with `redactionStatus: "blocked"` cannot be returned or persisted as a context pack item.
- A section with `exactRequired: true` must include at least one source ref and, for durable claims, at least one proof ref.
- `compression_orientation` may help navigation only. It cannot satisfy required proof, exact code, warning, or pinned context.

## Dependency Manifest Rules

- Every artifact must include a dependency manifest.
- Every section must reference dependency IDs used to build its body.
- Dependency hashes must be recalculated before diff generation.
- Any dependency hash mismatch makes the artifact `context_artifact_dirty`.
- If a dirty artifact was previously sent, the diff engine must emit `INVALIDATE_PREVIOUS`.
- Compression artifacts listed as dependencies must include their own input hashes.

## Output Rules

- JSON is the canonical machine contract.
- Markdown is a rendering of the structured artifact or context pack. It must expose enough metadata for a coding agent to inspect why context was sent, which dependencies support it, what was omitted or restorable, and what safety warnings remain.
- MCP `agent_pack` must return structured compact preview `contextPackItems` plus rendered Markdown; `outputMode: "full"` may return full `ContextPackItem.content`.
- CLI snapshot tests must validate rendered Markdown, but golden contract tests must validate JSON.

## Required Golden Tests

- `context_artifact_requires_dependency_manifest`
- `context_section_requires_content_hash`
- `high_risk_section_requires_exact_source_span`
- `blocked_redaction_prevents_artifact_return`
- `artifact_hash_is_deterministic`
- `manifest_hash_change_marks_artifact_dirty`
- `mcp_context_pack_items_match_markdown_render`

Current implementation coverage: `tests/behavior/context-artifact-contract.test.mjs` validates the public CLI JSON envelope, dependency manifest, artifact input refs, output section refs/content hashes, V1 context-pack item shape, absence of legacy `body` fields, and MCP Markdown parity for structured context-pack item IDs, kinds, refs, and content hashes. Existing CLI/compiler/diff tests cover high-risk exact-source gating, blocked-redaction restore prevention, deterministic artifact hashing, and manifest-hash invalidation. Broader durable-claim retrieval golden fixtures remain pending.
