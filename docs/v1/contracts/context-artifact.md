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

Canonical V1 artifact schemas live in `docs/v1/SPEC.md` sections 25.1 and 25.2. The current implementation work uses narrower `InMemory*Shape` types so the scaffold cannot masquerade as the final V1 contract.

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

It emits task, repository-state, allowed-source-manifest, file-relationship, and index-confidence sections. Its dependency manifest includes repo snapshot, worktree state, selected source/config/lockfile records, and selected symbol relationships. Aggregate source/index sections retain repo snapshot and worktree dependencies so empty or all-unindexed repositories still produce inspectable partial context. Relationship summaries render repository paths when known, with symbol IDs kept as supporting identities.

`grape compile --task <text>` now writes this scaffold as inspectable JSON and Markdown under `.grape/artifacts/ctx_<id>.json` and `.grape/artifacts/ctx_<id>.md`, after a basic artifact-level secret scan. These files are useful for CLI review and session-diff testing, but they are still marked as `InMemoryContextArtifactShape` scaffold output. The artifact ID identifies a compile output instance; the artifact hash is the deterministic content identity and excludes `createdAt` and instance IDs.

Risk overlays currently mark the scaffold artifact unsafe with `risk_overlay_exact_spans_not_implemented`, because V1 still needs exact source-span selection before high-risk compiles can be reported as safe.

`grape artifacts --artifact <id>` and MCP `grape_get_artifact` expose stored scaffold artifact metadata, dependency rows, and repo-relative artifact file refs for inspection. They do not return a final V1 artifact schema and do not promote scaffold summaries to proof.

This is not yet the final V1 artifact product. It does not yet implement the final V1 JSON schema or select exact spans for high-risk overlays.

## Section Rules

- `pinned_rule`, `risk_warning`, `stale_warning`, `contradiction`, and high-risk exact sections must not be replaced by compression.
- High-risk overlays require exact code/config/rule spans for required context.
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
- Markdown is a rendering of the structured artifact or context pack.
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
