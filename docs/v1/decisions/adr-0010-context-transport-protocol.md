# ADR-0010: V1 Context Transport Protocol

## Status

Accepted

## Context

Grape V1 was originally described as a broad incremental context compiler with claims, proofs, indexing, and memory-like behavior. Comparable open-source projects (for example graph- and claim-based memory systems) already ship heavy repository graphs, hybrid search, session ingestion, and compiled proof sets under a server stack.

Grape already implements a durable session ledger, `ContextPackItem` diff states, dependency invalidation, and MCP/CLI adapters. The highest-leverage differentiator is not duplicating a full memory platform in V1, but making **session-safe context transport** the primary outward contract.

## Decision

V1 is anchored on the **Context Transport Protocol**:

1. **Compile** git-aware, proof-backed repository context into a `ContextArtifact` with a dependency manifest.
2. **Diff** that artifact against what the current agent session has already received.
3. **Ship** a structured `ContextPack` whose items use the canonical diff states: `NEW`, `CHANGED`, `PINNED`, `OMIT_UNCHANGED`, `INVALIDATE_PREVIOUS`, `RESTORE_AVAILABLE`.

Supporting features (snapshot, indexing, excerpts, proofs, rules, compression cache, budgets, inspection) exist to make compilation and diffing **correct**, not to compete on full knowledge-graph or embedding search breadth in V1.

V1 is **local-first** (`.grape/`, SQLite, MCP/CLI). V1 does **not** require a Docker/Postgres/Chroma product stack.

## Consequences

- Public roadmap and alpha exit criteria prioritize **protocol hardening**, **npm install**, and **turn-2 token savings with zero unsafe omissions**.
- Broader claim ontologies, deep repo graphs, embeddings, and chat-session ingestion hooks are **V1.5/V2**, or **integration** with external tools—not V1 heroes.
- `docs/v1/contracts/context-diff.md` is a first-class contract alongside `context-artifact.md`.
- New features must pass the filter: improve **compile quality**, **git validity**, or **diff correctness**; avoid "bigger graph than X" as a V1 goal.

## Alternatives

- **Full PCKC memory platform in V1:** Rejected for scope; overlaps with existing memory/graph projects and delays proving the transport wedge.
- **Protocol-only with no compiler:** Rejected; empty diffs are not useful. Minimum compile features remain required.
- **IDE-only integration:** Rejected; MCP/CLI agent-agnostic transport stays required.

## Supersedes

None. This ADR refocuses V1 emphasis; it does not invalidate existing invariants, storage, or trust rules.

## Related Spec Sections

- `docs/v1/SPEC.md` §0 Executive Summary
- `docs/v1/contracts/context-diff.md`
- `docs/v1/contracts/context-artifact.md`
- `docs/v1/architecture/invariants.md` (`INV-DIFF-*`)
