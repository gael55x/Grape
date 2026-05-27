# V1 Compression

## Purpose

Define compression as deterministic derived cache, not truth.

## Source Of Truth

Compression follows the cache-only contract in `docs/v1/SPEC.md`.

## Update Triggers

- compression artifact type changes
- invalidation behavior changes
- compiler policy uses compression differently
- benchmark metrics change

## Agent Checks

Before editing compression code, agents must verify:

- compression artifacts cannot become proofs
- summaries cannot promote claims
- stale compression emits invalidation when previously sent
- high-risk overlays use exact required context

## V1 Rule

V1 compression is deterministic only. Model-written summaries, branch summaries, and session summaries are V1.1+ unless explicitly re-scoped through a spec change.

## Allowed Artifact Types

```ts
type CompressionArtifactType =
  | "symbol_outline"
  | "rule_digest"
  | "context_pack_summary"
  | "decision_digest"
  | "failure_timeline"
  | "module_outline"
  | "test_summary";

type CompressionMethod = "deterministic";

interface CompressionArtifact {
  compressionId: string;
  type: CompressionArtifactType;
  method: CompressionMethod;
  inputRefs: string[];
  inputHashes: string[];
  policyHash: string;
  scopeHash: string;
  outputHash: string;
  createdAt: string;
  invalidatedAt?: string;
  invalidationReason?: string;
}
```

## Invariants

- Compression is cache, not truth.
- Summary is never proof.
- A compression artifact must never appear in a `ProofRef`.
- A compression artifact is invalid unless every input hash still matches.
- `context_pack_summary` is a deterministic ledger of sent item IDs, labels, hashes, states, and timestamps. It is not a freeform summary.
- Active contradictions, stale warnings, missing verification warnings, pinned invariants, and high-risk exact sections are never compressed away.

## High-Risk Rule

If any active `RiskOverlay` is present, compression may provide orientation only. It must not replace exact required code, config, proof, rule, contradiction, invariant, stale-warning, or missing-verification sections.

High-risk overlays:

```text
security
auth
permissions
payments
webhooks
secrets
crypto
migration
production_config
```

## Invalidation Flow

```mermaid
flowchart TD
  Input[Input source or policy changes] --> Hash[Input hash mismatch]
  Hash --> Mark[Mark compression artifact invalid]
  Mark --> CheckSent{Was derived context sent?}
  CheckSent -->|yes| Invalidate[Emit INVALIDATE_PREVIOUS]
  CheckSent -->|no| Rebuild[Rebuild or fall back to exact context]
  Invalidate --> Rebuild
```

## Compiler And Diff Interaction

- The compiler may read valid compression artifacts for orientation sections.
- The compiler must list used compression artifacts in the artifact dependency manifest.
- The diff engine must invalidate previously sent items if their compression dependency becomes stale.
- Token savings from compression must be measured separately from token savings from diff omission.

## Current Implementation

The implemented compression slice persists deterministic `symbol_outline` and `rule_digest` artifacts in SQLite through `compression_artifacts` and `compression_inputs`. Local compile builds the symbol outline from the current snapshot's lightweight symbol nodes and relationship edges, and builds the rule digest from verified active rule excerpts after source-hash and excerpt-hash proof validation. Each artifact stores its input hashes, adds `compression_artifact` dependency rows, and renders in the shared `compression-orientation` section.

This section is orientation only. It has no proof refs, is not pinned, is not exact-required, cannot satisfy high-risk exact context, and cannot promote durable claims. The `rule_digest` stores rule source refs, line spans, proof refs, and hashes only; exact rule text remains in the pinned active-project-rules section. `context_pack_summary` remains pending V1 work, as do budget pruning and stale compression invalidation events.

## Required Tests

- `compression_artifact_requires_input_hashes`
- `compression_artifact_never_valid_proof`
- `high_risk_overlay_forbids_summary_replacement`
- `context_pack_summary_is_deterministic`
- `stale_compression_emits_invalidated_previous_when_sent`
- `compression_dependency_is_in_artifact_manifest`
