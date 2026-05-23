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

## Canonical Schemas

```ts
type TaskType =
  | "general"
  | "refactor"
  | "feature"
  | "bugfix"
  | "test"
  | "docs"
  | "security"
  | "auth"
  | "permissions"
  | "payments"
  | "webhooks"
  | "secrets"
  | "crypto"
  | "migration"
  | "production_config";

type RiskOverlay =
  | "security"
  | "auth"
  | "permissions"
  | "payments"
  | "webhooks"
  | "secrets"
  | "crypto"
  | "migration"
  | "production_config";

type DiffState =
  | "NEW"
  | "CHANGED"
  | "PINNED"
  | "OMIT_UNCHANGED"
  | "INVALIDATE_PREVIOUS"
  | "RESTORE_AVAILABLE";

interface ContextInput {
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

interface ContextSection {
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

interface ContextDependency {
  id: string;
  kind:
    | "repo_snapshot"
    | "worktree_state"
    | "source_file"
    | "proof"
    | "claim"
    | "rule"
    | "compression_artifact"
    | "session_ledger";
  ref: string;
  hash: string;
  scope: Record<string, unknown>;
}

interface ContextDependencyManifest {
  manifestId: string;
  dependencies: ContextDependency[];
  createdAt: string;
  hashAlgorithm: "sha256";
  manifestHash: string;
}

interface ContextPackItem {
  itemId: string;
  artifactId: string;
  sectionId: string;
  state: DiffState;
  title: string;
  body: string;
  contentHash: string;
  previousItemId?: string;
  restoreToken?: string;
  pinned: boolean;
  warnings: string[];
}

interface ContextArtifact {
  artifactId: string;
  input: ContextInput;
  sections: ContextSection[];
  dependencyManifest: ContextDependencyManifest;
  warnings: string[];
  unsafeReasons: string[];
  createdAt: string;
  artifactHash: string;
}
```

## Minimum Artifact Rule

A context artifact is invalid unless it is:

- task-specific
- branch/worktree-aware
- proof-backed where claims are durable
- dependency-tracked
- diffable
- inspectable
- invalidatable
- redaction-scanned

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
