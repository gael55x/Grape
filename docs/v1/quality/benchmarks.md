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

The In-Memory Context Loop uses deterministic approximate token accounting only. It is a foundation for comparing naive resend cost with structured context pack cost before a real tokenizer and benchmark harness exist.

Rules:

- `naiveTokens` estimates the cost of resending every selected in-memory section.
- `grapeTokens` estimates the cost of the emitted in-memory context pack items.
- `omittedUnchangedTokens` estimates the section tokens omitted by `OMIT_UNCHANGED`.
- `compressionSavedTokens` is always `0` in the in-memory loop because compression is out of scope.
- `pinnedOverheadTokens` is reported separately because pinned safety context is intentionally resent.
- `invalidationOverheadTokens` is reported separately when `INVALIDATE_PREVIOUS` exists.
- `unsafeOmissions` must be `0`; otherwise the token-saving result is invalid.
- These numbers are not release benchmark claims. They only prove the accounting path exists.

## Current Benchmark Harness

The current product harness is `grape bench --fixture <name>`. It is intentionally narrow: it copies a named fixture into a temporary Git repository, commits the fixture, runs the real local `compileLocalContext` path twice with the same session, and reports the token accounting already persisted by the context diff pipeline.

Supported options:

- `--fixture <name>`: required named fixture.
- `--fixture-path <path>`: optional explicit fixture directory.
- `--repo <path>`: base path for default fixture lookup at `<repo>/tests/fixtures/<name>`.
- `--task <text>`: optional benchmark task; defaults to the fixture scenario task.
- `--json`: machine-readable output.
- `--keep-workspace`: preserve the copied temporary benchmark workspace for debugging.

Fixture name selects the benchmark scenario:

| Fixture | Benchmark id |
|---|---|
| `clean-typescript-app` | `bench_token_reduction_after_first_turn` |
| `branch-switch-typescript-app` | `bench_branch_switch_invalidation` |
| `stale-source-typescript-app` | `bench_stale_source_invalidation` |
| `session-reset-typescript-app` | `bench_diff_vs_naive_resend` |
| `polyglot-fallback-repo` | `bench_token_reduction_after_first_turn` |
| `monorepo-lite-repo` | `bench_token_reduction_after_first_turn` |

Each fixture metadata file owns its default `benchmarkTask`. `--task <text>` overrides that fixture-owned task for ad hoc local inspection.

Run all fixtures:

```bash
npm run benchmark:run
```

Comparative benchmark harness (beta candidate tarball, not the published registry package):

```bash
npm run bench
npm run bench:summary
npm run bench:comparators   # skips unavailable external tools
```

`npm run bench` builds `dist/`, runs `npm pack`, installs the tarball, and runs all fixtures through the **installed** `grape` binary. This exercises the beta candidate artifact from the current git tree.

See [`../../../benchmarks/README.md`](../../../benchmarks/README.md) and [`../planning/benchmark-readiness-report.md`](../planning/benchmark-readiness-report.md).

Alpha e2e (dist build, pack install smoke, benchmark suite from installed package):

```bash
npm run e2e:alpha
```

Full beta-readiness gate (check, benchmarks, alpha e2e, packaged MCP client trial):

```bash
npm run beta:check
```

`npm run beta:check` ends with `npm run beta:client-trial`, which installs the packed tarball in a temporary consumer repo and exercises MCP stdio transport end to end. That trial is an internal harness check, not an external benchmark superiority claim.

### Recorded baselines (local fixture reference, 2026-06-13)

On the recorded fixture run dated **2026-06-13**, Grape produced the listed token and invalidation results under the documented harness limits.

| Field | Value |
|---|---|
| Command | `npm run bench` |
| Git commit | `e8a1656298b1de9a47f3ecfe158c6d530094d31a` (`v1.0.0-beta.0`) |
| Package version | `1.0.0-beta.0` (packed tarball from git tree) |
| Node | `v22.18.0` on `darwin` |
| Fixtures | all six gated fixtures below |
| Limits | harness thresholds in this doc; zero unsafe omissions; zero stale sends |
| Caveats | local fixture results only; npm registry publish was pending human authentication at record time; not proof of production savings or external tool superiority |

| Fixture | Turn 1 tokens | Turn 2 tokens | Turn 2 reduction | Serialized agent output | Agent output overhead | `OMIT_UNCHANGED` | `INVALIDATE_PREVIOUS` | Unsafe |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `clean-typescript-app` | 2811 | 1663 | 50.4% | 26021 | 215.35% | 7 | 1 | 0 |
| `branch-switch-typescript-app` | 2811 | 3440 | 0% | 27460 | 216.13% | 0 | 9 | 0 |
| `stale-source-typescript-app` | 2811 | 3600 | 0% | 27824 | 215.91% | 0 | 9 | 0 |
| `session-reset-typescript-app` | 3770 | 4947 | 0% | 32561 | 182.2% | 0 | 9 | 0 |
| `polyglot-fallback-repo` | 3132 | 2523 | 31.46% | 20191 | 121.71% | 7 | 1 | 0 |
| `monorepo-lite-repo` | 3388 | 1885 | 52.07% | 28509 | 186.32% | 7 | 1 | 0 |

Token reduction thresholds apply to no-change transport fixtures: `clean-typescript-app`, `polyglot-fallback-repo`, and `monorepo-lite-repo`. Invalidation benchmarks require `INVALIDATE_PREVIOUS > 0` on turn 2 with zero unsafe omissions. The session-reset benchmark also requires `NEW > 0` and `OMIT_UNCHANGED = 0` on the reset turn to prove the agent receives a safe full resend instead of a no-change omission.

Current benchmark thresholds:

- first-turn overhead must be no more than 10 percent above naive resend
- first-turn serialized agent-output overhead must be no more than 400 percent above naive resend
- second-turn reduction must be at least 30 percent (internal CI harness threshold on gated no-change fixtures; not a user-facing savings claim)
- unsafe omissions must be zero
- stale items sent must be zero
- second turn must include at least one `OMIT_UNCHANGED`
- second turn must include at least one `RESTORE_AVAILABLE`

Benchmark output also reports serialized context-pack token estimates, serialized default agent-output token estimates, and token breakdowns by diff state and section. These are transport diagnostics: body-token counts explain logical context savings, serialized-pack counts show JSON overhead from metadata, restore hints, and dependency references, and serialized-agent-output counts estimate the default MCP `agent_pack` frame including compact text summary and compact preview structured content.

These numbers are deterministic approximate token estimates from named fixtures. They are valid as local harness checks because they fail on unsafe omission or stale send counters. They are not proof of production token savings or external tool superiority.

The current benchmark harness is ready for internal sanity checks, not external claims against Composer or Graphify. Official release benchmarking must add comparable scripted scenarios, publish sanitized raw results, and label fixture, command, date, and limits.

## Metric Schema

```ts
interface BenchmarkTurnMetric {
  fixture: string;
  taskId: string;
  turn: number;
  naiveTokens: number;
  grapeTokens: number;
  serializedPackTokens: number;
  serializedAgentOutputTokens: number;
  serializedAgentStructuredTokens: number;
  serializedAgentTextTokens: number;
  omittedUnchangedTokens: number;
  compressionSavedTokens: number;
  pinnedOverheadTokens: number;
  invalidationOverheadTokens: number;
  unsafeOmissions: number;
  staleItemsSent: number;
  reductionPercent: number;
  overheadPercent: number;
  agentOutputOverheadPercent: number;
  stateTokenBreakdown: Array<{
    state: DiffState;
    itemCount: number;
    bodyTokens: number;
    serializedTokens: number;
  }>;
  sectionTokenBreakdown: Array<{
    sectionId: string;
    state: DiffState;
    itemKind: ContextPackItemKind;
    itemRef: string;
    bodyTokens: number;
    serializedTokens: number;
  }>;
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

## Minimum Harness Targets

- Zero trust violations.
- Zero summary-as-proof violations.
- Zero branch-invalid active claims.
- Zero stale proof dependencies in active artifacts.
- Zero omitted pinned safety sections.
- First-turn token cost reported separately from later-turn cost.
- Later-turn token reduction measured on the six gated no-change and invalidation fixtures above. Broader gold-label and sync-time fixtures in the metrics table below are not yet bench-gated.

## Required Benchmark Names

- `bench_token_reduction_after_first_turn`
- `bench_diff_vs_naive_resend`
- `bench_no_change_sync_time`
- `bench_changed_file_invalidation_time`
- `bench_current_valid_gold_labels`
- `bench_compression_invalidation`
- `bench_session_lock_collision`
- `bench_restore_omitted_item`
