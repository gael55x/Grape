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

## Phase Roadmap

| Phase | Goal | Deliverables | Required tests/benchmarks | Non-goals |
|---|---|---|---|---|
| 0A | Make implementation rules enforceable before code. | `SPEC.md`, domain docs, ADRs, invariants, state matrix, test/benchmark standards. | docs lint/readability checks when available. | production code, schema implementation. |
| 0B | Prove the smallest safe context compiler loop. | one fixture repo, repo snapshot, evidence, proof-backed claim, artifact, diff, MCP/CLI path. | alpha golden tests, unsafe omission tests, first token benchmark. | broad language support, embeddings, model summaries. |
| 1 | Establish project skeleton and tooling. | package structure, TypeScript config, test runner, lint/format, CI skeleton. | smoke tests and docs gate checks. | feature behavior beyond skeleton. |
| 2 | Implement SQLite schema and migrations. | repository layer, migrations, WAL/busy timeout policy. | migration, transaction, lock, path tests. | business policy in storage. |
| 3 | Capture repo snapshot and worktree state. | branch/commit/dirty/hash snapshot services. | clean/dirty/branch fixtures. | deep call graph indexing. |
| 4 | Build evidence store. | source records, rejections, hashes, privacy status. | ignored file, source hash, rejection tests. | durable claim promotion. |
| 5 | Build Trust Kernel and proof validation. | proof validators, belief gate, promotion rules. | trust safety, proof hash, partial verification tests. | model judgment as proof. |
| 6 | Implement claims and layer isolation. | durable claims, scratch claims, claim edges. | no hidden promotion, contradiction/supersession tests. | advanced contradiction AI. |
| 7 | Ingest project rules. | pinned rules, rule proofs, rule digests. | pinned resend and stale rule tests. | remote/team rules. |
| 8 | Build symbol/file index and FTS. | lexical index, basic symbol outlines, path normalization. | FTS, secret exclusion, cross-platform path tests. | full semantic graph. |
| 9 | Implement current-valid retrieval. | scope matching, stale filtering, partial warnings. | gold label current-valid tests. | relevance ranking over stale facts. |
| 10 | Implement context artifact compiler. | artifact schema, sections, manifests, redaction scan. | artifact golden tests. | compression optimization first. |
| 11 | Implement context diff and session locks. | sent ledger, omitted ledger, restore, invalidation. | session isolation, pinned resend, restore tests. | global context lock. |
| 12 | Add lightweight compression cache. | deterministic symbol/rule/ledger cache. | input hash and invalidation tests. | model summaries, branch summaries. |
| 13 | Add MCP server. | read tools, restricted write tools, schemas. | MCP contract and safety tests. | MCP writes promoting truth. |
| 14 | Add CLI inspection/debugging. | status, doctor, artifacts, claims, stale, omitted, bench shell. | CLI snapshots and JSON schema tests. | CLI business logic. |
| 15 | Build benchmarks and hardening. | benchmark harness, gold labels, baseline scripts. | benchmark determinism and thresholds. | unmeasured token claims. |
| 16 | Alpha release checklist. | release docs, known limitations, fixture results. | full alpha test/benchmark suite. | V1.1/V2 features. |

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
