# V1 Benchmarks

## Purpose

Define benchmark categories, fixture baselines, and acceptance thresholds.

## Source Of Truth

Benchmark claims must follow `docs/v1/SPEC.md`. Token-saving claims are invalid without scripted baselines and labeled fixtures.

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

## Baseline Rules

- Every token benchmark uses a named fixture and scripted agent workflow.
- Naive baseline means "resend all selected context every turn" using the same fixture and task.
- First-turn cost and later-turn cost are reported separately.
- Diff omission savings and compression savings are reported separately.
- Unsafe omissions, stale sends, and missing pinned context are zero-tolerance correctness failures.
- Results include wall-clock time, tool-call count, token count, and invalidation count.

## In-Memory Token Accounting

The In-Memory Context Loop uses deterministic approximate token accounting only. It is a scaffold for comparing naive resend cost with structured context pack cost before a real tokenizer and benchmark harness exist.

Rules:

- `naiveTokens` estimates the cost of resending every selected in-memory section.
- `grapeTokens` estimates the cost of the emitted in-memory context pack items.
- `omittedUnchangedTokens` estimates the section tokens omitted by `OMIT_UNCHANGED`.
- `compressionSavedTokens` is always `0` in the in-memory loop because compression is out of scope.
- `pinnedOverheadTokens` is reported separately because pinned safety context is intentionally resent.
- `invalidationOverheadTokens` is reported separately when `INVALIDATE_PREVIOUS` exists.
- `unsafeOmissions` must be `0`; otherwise the token-saving result is invalid.
- These numbers are not release benchmark claims. They only prove the accounting path exists.

## Metric Schema

```ts
interface TokenSavingsMetric {
  fixture: string;
  taskId: string;
  turn: number;
  naiveTokens: number;
  grapeTokens: number;
  omittedUnchangedTokens: number;
  compressionSavedTokens: number;
  pinnedOverheadTokens: number;
  invalidationOverheadTokens: number;
  unsafeOmissions: number;
  staleItemsSent: number;
}
```

## Required Metrics

| Metric | Purpose | Input fixture | Expected output | Failure threshold | Why it matters |
|---|---|---|---|---|---|
| token reduction after first turn | prove incremental diff value | `clean-typescript-app`, `auth-security-fixture` | lower later-turn tokens than naive resend | less than 30 percent reduction after turn 2 or any unsafe omission | validates wedge after initial cost |
| diff token cost versus naive resend | isolate diff savings | `session-reset-fixture` | omitted unchanged tokens and pinned overhead reported | missing formula or stale item sent | prevents benchmark gaming |
| no-change sync time | prove cache/incremental path | `clean-typescript-app` | bounded no-change runtime | more than 2x baseline after warm cache | keeps local-first usable |
| changed-file sync time | prove invalidation cost | `stale-proof-repo` | changed file invalidates only dependent artifacts | stale dependency not detected | validates manifests |
| context compile time | measure compile overhead | `auth-security-fixture` | artifact time and section count | compile too slow for alpha target or missing exact spans | proves UX viability |
| current-valid retrieval correctness | validate safety filter | labeled branch/scope fixtures | precision/recall against gold labels | less than 95 percent on gold fixtures | prevents stale context |
| trust violation rate | detect invalid promotion | all trust fixtures | zero invalid durable claims | any invalid durable claim | trust is core safety property |
| summary-as-proof violations | enforce compression boundary | `compression-invalidation-fixture` | zero summaries accepted as proof | any accepted summary proof | prevents cache becoming truth |
| branch-invalid retrieval violations | enforce branch scope | `branch-switch-repo` | zero branch-mismatch active claims | any mismatch active | prevents wrong-branch context |
| stale invalidation correctness | validate proof/artifact invalidation | `stale-proof-repo` | all stale dependents invalidated | any stale dependent active | prevents stale truth |
| compression invalidation correctness | validate cache invalidation | `compression-invalidation-fixture` | stale cache invalidated and prior sent items invalidated | stale cache reused silently | prevents stale compression |
| session lock collision rate | validate concurrency | `parallel-agents-fixture` | deterministic conflict/serialization behavior | cross-session contamination | prevents agent bleed |
| MCP response latency | measure adapter overhead | MCP scripted workflow | response latency and item counts | p95 exceeds alpha target without warning | keeps tool usable |
| context artifact determinism | validate reproducibility | `clean-typescript-app` | same inputs produce same artifact hash | hash changes without input change | enables diffing |
| restore omitted item success rate | validate restore path | `session-reset-fixture` | restorable omissions resolve or invalidate safely | stale content restored | prevents hidden context loss |

## Minimum Alpha Targets

- Zero trust violations.
- Zero summary-as-proof violations.
- Zero branch-invalid active claims.
- Zero stale proof dependencies in active artifacts.
- Zero omitted pinned safety sections.
- First-turn token cost reported separately from later-turn cost.
- Later-turn token reduction target is provisional until fixtures are implemented.

## Required Benchmark Names

- `bench_token_reduction_after_first_turn`
- `bench_diff_vs_naive_resend`
- `bench_no_change_sync_time`
- `bench_changed_file_invalidation_time`
- `bench_current_valid_gold_labels`
- `bench_compression_invalidation`
- `bench_session_lock_collision`
- `bench_restore_omitted_item`
