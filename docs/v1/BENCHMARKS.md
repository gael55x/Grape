# V1 Benchmarks

## Purpose

Define benchmark categories, fixture baselines, and acceptance thresholds.

## Required Contents

- benchmark fixture list
- scripted naive baselines
- token metrics
- latency metrics
- trust violation metrics
- failure thresholds
- reporting format

## Readers

Benchmark implementers, release maintainers, and agents evaluating token-saving claims.

## Update Triggers

- benchmark added or changed
- fixture baseline changes
- performance target changes
- token-saving claim changes

## Agent Checks

Before adding benchmark code, agents must verify:

- fixture expected output is labeled
- baseline is scripted and repeatable
- unsafe omission count is measured
- benchmark does not use ad hoc comparisons

## Required Metrics

- token reduction after first turn
- diff token cost versus naive resend
- no-change sync time
- changed-file sync time
- context compile time
- current-valid retrieval correctness
- trust violation rate
- summary-as-proof violations
- branch-invalid retrieval violations
- stale invalidation correctness
- compression invalidation correctness
- session lock collision rate
- MCP response latency
- context artifact determinism
- restore omitted item success rate
