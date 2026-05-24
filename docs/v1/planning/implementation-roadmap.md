# V1 Implementation Roadmap

## Purpose

Define the order of implementation and prevent feature work from jumping ahead of foundations.

## Required Contents

Each implementation goal must define:

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

- implementation order changes
- scope moves between V1 and later versions
- exit criteria change

## Agent Checks

Before implementation, agents must confirm the work belongs to the current goal.

## Goal Names

The roadmap uses goal names instead of numeric planning labels. The canonical V1 spec starts with an alpha vertical slice; this docs tree keeps a prerequisite documentation goal so the implementation contract, agent rules, and quality gates are enforceable before production code starts.

- Documentation Foundation: make implementation rules enforceable before code.
- Alpha Context Loop: prove the smallest safe context compiler loop from `SPEC.md`.

No product code should start before the Documentation Foundation is complete. Alpha Context Loop is the first implementation slice.

## Ordered Goals

1. Documentation Foundation
2. Alpha Context Loop
3. Project Skeleton And Tooling
4. SQLite Schema And Migrations
5. Repo Snapshot And Worktree State
6. Evidence Store
7. Trust Kernel And Proof Validation
8. Claims And Layer Isolation
9. Project Rules Ingestion
10. Symbol/File Index And FTS
11. Current-Valid Retrieval
12. Context Artifact Compiler
13. Context Diff Engine And Session Locks
14. Lightweight Compression Cache
15. MCP Server
16. CLI Inspection/Debugging
17. Benchmarks And Hardening
18. Alpha Release Checklist

## Roadmap

| Goal | Deliverables | Required tests/benchmarks | Non-goals |
|---|---|---|---|
| Documentation Foundation | `SPEC.md`, domain docs, ADRs, invariants, state matrix, test/benchmark standards. | docs lint/readability checks when available. | production code, schema implementation. |
| Alpha Context Loop | one fixture repo, repo snapshot, evidence, proof-backed claim, artifact, diff, MCP/CLI path. | alpha golden tests, unsafe omission tests, first token benchmark. | broad language support, embeddings, model summaries. |
| Project Skeleton And Tooling | package structure, TypeScript config, test runner, lint/format, CI skeleton. | smoke tests and docs gate checks. | feature behavior beyond skeleton. |
| SQLite Schema And Migrations | repository layer, migrations, WAL/busy timeout policy. | migration, transaction, lock, path tests. | business policy in storage. |
| Repo Snapshot And Worktree State | branch/commit/dirty/hash snapshot services. | clean/dirty/branch fixtures. | deep call graph indexing. |
| Evidence Store | source records, rejections, hashes, privacy status. | ignored file, source hash, rejection tests. | durable claim promotion. |
| Trust Kernel And Proof Validation | proof validators, belief gate, promotion rules. | trust safety, proof hash, partial verification tests. | model judgment as proof. |
| Claims And Layer Isolation | durable claims, scratch claims, claim edges. | no hidden promotion, contradiction/supersession tests. | advanced contradiction AI. |
| Project Rules Ingestion | pinned rules, rule proofs, rule digests. | pinned resend and stale rule tests. | remote/team rules. |
| Symbol/File Index And FTS | lexical index, basic symbol outlines, path normalization. | FTS, secret exclusion, cross-platform path tests. | full semantic graph. |
| Current-Valid Retrieval | scope matching, stale filtering, partial warnings. | gold label current-valid tests. | relevance ranking over stale facts. |
| Context Artifact Compiler | artifact schema, sections, manifests, redaction scan. | artifact golden tests. | compression optimization first. |
| Context Diff Engine And Session Locks | sent ledger, omitted ledger, restore, invalidation. | session isolation, pinned resend, restore tests. | global context lock. |
| Lightweight Compression Cache | deterministic symbol/rule/ledger cache. | input hash and invalidation tests. | model summaries, branch summaries. |
| MCP Server | read tools, restricted write tools, schemas. | MCP contract and safety tests. | MCP writes promoting truth. |
| CLI Inspection/Debugging | status, doctor, artifacts, claims, stale, omitted, bench shell. | CLI snapshots and JSON schema tests. | CLI business logic. |
| Benchmarks And Hardening | benchmark harness, gold labels, baseline scripts. | benchmark determinism and thresholds. | unmeasured token claims. |
| Alpha Release Checklist | release docs, known limitations, fixture results. | full alpha test/benchmark suite. | V1.1/V2 features. |

## Current Goal

Alpha Context Loop.

Documentation Foundation is complete. Alpha Context Loop is the first implementation slice and must stay limited to `alpha-context-loop.md`.

## Documentation Foundation Exit Criteria

- documentation architecture exists
- committed canonical spec exists at `docs/v1/SPEC.md`
- state machine is documented
- invariants are documented
- dependency direction is documented
- agent operating rules exist
- testing and benchmark standards exist
- changelog, spec changelog, implementation log, and ADR structure exist

Status: complete.

## Alpha Context Loop Exit Criteria

- alpha scope is documented in `alpha-context-loop.md`
- smallest end-to-end alpha path compiles a safe context artifact
- proof-backed claim promotion is implemented for the alpha source types
- current-valid filtering runs before artifact compilation
- session-scoped diffing emits structured `ContextPackItem` values
- high-risk pinned context is resent
- stale dependencies invalidate artifacts and previous context
- alpha benchmarks measure first-turn cost, later-turn cost, and unsafe omissions
- no compression artifact can act as proof
