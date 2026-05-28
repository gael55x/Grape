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

Canonical V1 artifact schemas live in `docs/v1/SPEC.md` sections 25.1 and 25.2. The current implementation keeps narrower `InMemory*Shape` types internally so the scaffold cannot masquerade as durable truth, then projects that scaffold into a public V1 `ContextArtifact` JSON shape for CLI/MCP consumers.

```ts
interface InMemoryContextRequest {
  taskId: string;
  sessionId: string;
  repoId: string;
  branch: string;
  commit: string;
  worktreeHash: string;
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

Current CLI, artifact JSON, and MCP output map internal scaffold diff rows to the V1 `ContextPackItem` output shape before returning them to agents. The emitted item fields are `id`, `state`, `itemKind`, `itemRef`, optional `sectionId`, `title`, `content`, `contentHash`, `tokenCount`, `pinned`, `safetyCritical`, optional `invalidatesSentItemId`, optional `restoreId`, `inputRefs`, and `warnings`.

Public `.grape/artifacts/ctx_<id>.json` files now include:

- `artifactFormat: "grape.context-pack.v1"`
- `artifactFormatVersion: 1`
- `contextArtifact`, a V1 `ContextArtifact` projection with output sections, dependency manifest, compile mode, confidence fields, token fields, and current branch/worktree identity
- `contextPackItems`
- `omittedItems`
- `tokenMetric`
- `budget`

The internal scaffold artifact is written separately to `.grape/artifacts/ctx_<id>.scaffold.json` for omitted-item restore verification. That sidecar is an implementation detail, not the public agent contract.

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

An in-memory artifact shape is not a final V1 artifact. It is valid only as a scaffold when its name remains `InMemoryContextArtifactShape`, every exposed surface labels it as scaffold output, and docs do not claim it is the final V1 artifact schema.

## Current Repository-Derived Compiler Foundation

The current compiler foundation can build an `InMemoryContextArtifactShape` from persisted repo inputs:

- repo snapshot and worktree state records
- snapshot-derived source records
- persisted lightweight symbol nodes and relationship edges

It emits task, repository-state, allowed-source-manifest, active-project-rules when trusted rule files exist, exact-source-evidence, file-relationship, and index-confidence sections. Its dependency manifest includes repo snapshot, worktree state, selected source/config/lockfile/rule records, selected exact source proof refs, and selected symbol relationships. Aggregate source/index sections retain repo snapshot and worktree dependencies so empty or all-unindexed repositories still produce inspectable partial context. Relationship summaries render repository paths when known, with symbol IDs kept as supporting identities.

The scaffold compiler now emits a task-retrieval section when task terms, seed refs, source anchors, or retrieval warnings exist. The local compile service searches safe lexical rows and symbol/path metadata for the current snapshot, merges those matches with explicit seed file refs and path-like test seed refs, includes related test files that import already-selected source files, and passes selected source refs into the compiler. Selected refs are prioritized in source manifests, dependency manifests, symbol summaries, and bounded exact-source evidence. Path-like test seeds are rendered separately as test seed refs so agents can see why a test file was included. Import-related tests are rendered separately as related test refs. Non-path test names remain retrieval terms only. Exact-source excerpt windows prefer task-selected symbol line anchors when available, then fall back to task query terms around the first relevant matching line, then record the resulting start/end lines and excerpt hash as proof dependencies. This improves task specificity without treating lexical hits, symbol regex matches, test imports, or test file presence as durable proof of behavior.

The active-project-rules section is pinned. It is compiled from trusted `rule_file` source excerpts after the same source-hash verification used by exact-source-evidence. This gives agents exact, dependency-tracked local rule text without promoting parsed durable rule records yet.

The exact-source-evidence section is a scaffold proof foundation: it reads only already-allowed non-rule source records, verifies the current file/symlink bytes still match the stored source hash, truncates a bounded excerpt, records a deterministic proof ref, stores the excerpt hash as a proof dependency, and includes the exact excerpt in the artifact. This proves that the excerpt exists in the current source input. It does not promote durable claims or prove runtime behavior.

Local compile also resolves current-valid durable claims and renders a `current-valid-claims` `active_claim` section when verified narrow source-excerpt claims are active for the current branch, commit, source hash, and proof hash. The section includes claim refs, proof refs, source refs, and claim dependency rows. Current active claims only use `repository_source_excerpt_exists`; broader behavior, rule, test, command, and decision claims remain pending.

Local compile now persists deterministic `symbol_outline`, `rule_digest`, and `context_pack_summary` compression artifacts. Symbol/rule artifacts are built before compilation from the lightweight symbol index and verified active rule excerpts, then rendered as `compression-orientation`. Context-pack summaries are built after durable pack persistence from the session-scoped sent ledger and are cached for later budget/diff use, but they are not rendered into artifacts yet. The public V1 projection includes `compressionArtifactRefs`, `compressionArtifactsUsed`, and `compression_artifact` dependency refs for compression artifacts that are actually rendered. The compression section is non-proof orientation only; it has no proof refs and cannot satisfy exact-required or high-risk context. Exact rule text still lives in the pinned active-project-rules section; the rule digest carries only rule refs, line spans, proof refs, and hashes.

`grape compile --task <text>` now writes an inspectable V1 context-pack JSON and Markdown under `.grape/artifacts/ctx_<id>.json` and `.grape/artifacts/ctx_<id>.md`, after a basic artifact-level secret scan. The public JSON contains the V1 `ContextArtifact` projection plus the diffed `ContextPackItem[]`; the Markdown renders the same structured contract with an artifact summary, diff-state counts, pack item metadata/input refs, omitted/restore metadata, output section metadata, dependency manifest details, token metrics, budget status when requested, and warnings/safety fields. The internal scaffold sidecar remains available only so restore can verify section hashes against the original scaffold source. The artifact ID identifies a compile output instance; the artifact hash is the deterministic scaffold content identity and excludes `createdAt` and instance IDs.

When `--token-budget` or MCP `tokenBudget` is supplied, the durable pack builder applies budget policy before context pack rows are persisted. Required context means the task summary, pinned rules, exact/safety-critical sections, unchanged omission/restore metadata, and invalidation items. Required context is never pruned. If required context is larger than the requested budget, output is marked unsafe with `token_budget_below_required_context`. If required context fits but optional context does not, Grape prunes optional non-safety sections from the public `contextPackItems` and public `contextArtifact.outputSections`, records them in `contextArtifact.omittedDueToBudget` and `budget.omittedDueToBudget`, and returns `token_budget_pruned_optional_context`. Budget-pruned items are not treated as sent or restoreable; callers should rerun with a larger budget if they need those optional bodies.

Risk overlays now require task-selected exact source/config/rule evidence. If task retrieval selects at least one allowed source and the compiler can validate a proof-backed exact excerpt for that source, the high-risk compile may proceed as `partial_with_risk` or `safe_minimum` depending on other warnings. If no task-selected exact excerpt exists, the artifact is unsafe with `risk_overlay_missing_exact_context`.

`grape artifacts --artifact <id>` and MCP `grape_get_artifact` expose stored artifact metadata, dependency rows, and repo-relative public artifact file refs for inspection. They do not return raw scaffold sidecar bodies and do not promote scaffold summaries to proof.

Agent-authored artifact annotations are explicitly deferred from V1 rendered artifacts. Restricted MCP write tools may record temporary evidence, candidates, hashes, and confirmation request metadata, but those records do not mutate an artifact body or become current-valid context unless a future Trust Kernel flow validates proof and scope. See `docs/v1/decisions/adr-0008-agent-artifact-annotations.md`.

This is still a projection from the repository-derived scaffold rather than the final broad durable-claim retrieval system. It now uses the V1 `ContextArtifact` JSON envelope, enforces the first task-specific high-risk exact-span policy, can render current-valid narrow source-excerpt claims, and includes deterministic symbol/rule compression cache orientation, but broader durable claim types and rendered `context_pack_summary` orientation are not yet promoted.

## Section Rules

- `pinned_rule`, `risk_warning`, `stale_warning`, `contradiction`, and high-risk exact sections must not be replaced by compression.
- High-risk overlays require exact code/config/rule spans for required context. Bounded scaffold excerpts satisfy the current high-risk policy only when they are selected by task retrieval or explicit seed refs and have proof dependencies.
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
- MCP must return structured `contextPackItems` plus rendered Markdown.
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
