# V1 Implementation Phases

## Purpose

Define the order of implementation and prevent feature work from jumping ahead of foundations.

## Required Contents

Each phase must define:

- goal
- deliverables
- non-goals
- required docs
- required tests
- required benchmarks when applicable
- exit criteria
- risks
- what not to build yet

## Readers

Maintainers, contributors, and AI agents selecting implementation work.

## Update Triggers

- phase order changes
- scope moves between V1 and later versions
- exit criteria change

## Agent Checks

Before implementation, agents must confirm the work belongs to the current phase.

## Phase Naming

The canonical V1 spec defines an alpha vertical slice as Phase 0. This docs tree adds a prerequisite `Phase 0A` so the implementation contract, agent rules, and quality gates are enforceable before production code starts.

- `Phase 0A`: documentation and standards foundation.
- `Phase 0B`: alpha vertical slice from `SPEC.md`.

No product code should start before `Phase 0A` exits. `Phase 0B` is the first implementation slice.

## Phases

0A. Documentation and standards foundation
0B. Alpha vertical slice
1. Project skeleton and tooling
2. SQLite schema and migrations
3. Repo snapshot and worktree state
4. Evidence store
5. Trust Kernel and proof validation
6. Claims and layer isolation
7. Project rules ingestion
8. Symbol/file index and FTS
9. Current-valid retrieval
10. Context artifact compiler
11. Context diff engine and session locks
12. Lightweight compression cache
13. MCP server
14. CLI inspection/debugging
15. Benchmarks and hardening
16. Alpha release checklist

## Current Phase

Phase 0A: Documentation and standards foundation.

No serious production feature implementation should start until Phase 0A exit criteria are met.

## Phase 0A Exit Criteria

- documentation architecture exists
- committed canonical spec exists at `docs/v1/SPEC.md`
- state machine is documented
- invariants are documented
- dependency direction is documented
- agent operating rules exist
- testing and benchmark standards exist
- changelog, spec changelog, implementation log, and ADR structure exist

## Phase 0B Exit Criteria

- smallest end-to-end alpha path compiles a safe context artifact
- proof-backed claim promotion is implemented for the alpha source types
- current-valid filtering runs before artifact compilation
- session-scoped diffing emits structured `ContextPackItem` values
- high-risk pinned context is resent
- stale dependencies invalidate artifacts and previous context
- alpha benchmarks measure first-turn cost, later-turn cost, and unsafe omissions
- no compression artifact can act as proof
