# V1 Compression

## Purpose

Define compression as deterministic derived cache, not truth.

## Required Contents

- allowed V1 compression artifact types
- input hash requirements
- invalidation rules
- high-risk restrictions
- relationship to compiler and diff
- required tests and benchmarks

## Readers

Compression, compiler, diff, retrieval, and benchmark implementers.

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
