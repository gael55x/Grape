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
| `dirty-worktree-typescript-app` | `bench_dirty_worktree_invalidation` |
| `stale-source-typescript-app` | `bench_stale_source_invalidation` |
| `session-reset-typescript-app` | `bench_diff_vs_naive_resend` |
| `polyglot-fallback-repo` | `bench_token_reduction_after_first_turn` |
| `monorepo-lite-repo` | `bench_token_reduction_after_first_turn` |

Each fixture metadata file owns its default `benchmarkTask`. `--task <text>` overrides that fixture-owned task for ad hoc local inspection.

Each benchmark turn also reports measured local storage bytes after that turn. The fields include `.grape/`, `grape.db`, WAL, SHM, all artifact files, artifact JSON files, artifact Markdown files, and artifact repository backing files. These are diagnostics for the fixture workspace. They do not prove production storage use.

No-change token fixtures also report a `noChangeSync` gate. This gate has benchmark id `bench_no_change_sync_time`. It compares turn 2 full compile duration with turn 1 full compile duration, requires a clean turn 2 worktree, requires at least one safe unchanged omission, and fails on unsafe omissions or stale sends. It is a fixture guard for repeated-turn regressions. It is not an isolated filesystem sync benchmark and is not a general runtime claim.

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

Current Graphify comparator rows measure one-shot CLI orientation only. They do not measure Graphify's full MCP, update, hook, IDE, or multi-turn assistant workflow. Graphify is strongest at building a queryable repo knowledge graph. Grape is strongest at preserving safe context continuity across agent turns with session diff, restore, invalidation, and proof-backed excerpts.

Post-beta baseline harness (published npm registry package):

```bash
npm run bench:post-beta
npm run bench:post-beta:local
```

`npm run bench:post-beta` installs `grape-context@beta` from the registry and records the resolved package version in `artifactIdentity`. `npm run bench:post-beta:local` records `artifactIdentity: local-candidate:<git commit>` from a packed install for post-fix comparison only.

The uncapped mode measures maximum recall. The budgeted mode caps each baseline to the same case budget so the benchmark can compare context selection under equal pressure.

Post-beta grape rows report layered metrics separately: `retrievalSelectedRefs`, `evidenceRefs`, `projectRuleRefs`, `packInputRefs`, and `finalAgentFacingRefs`. Each layer records `relevanceRecall`, `knownNoiseRatio`, and `selectedCount`. The harness records `searchEngine` as `rg` or `node-fallback` in the environment block. Uncommitted local JSON under `benchmarks/results/` is local trial evidence only. Public claims require committed raw result files and the caveats in those files.

Committed published-package results live under `benchmarks/results/post-beta-*-published-beta.json`. Committed transport fixture result files, when present, use `benchmarks/results/run-*.json`.

See [`../../../benchmarks/README.md`](../../../benchmarks/README.md) and [`../legacy/alpha/benchmark-readiness-report.md`](../legacy/alpha/benchmark-readiness-report.md) for historical pre-beta evidence.

Alpha e2e (dist build, pack install smoke, benchmark suite from installed package):

```bash
npm run e2e:alpha
```

Full beta-readiness gate (check, benchmarks, alpha e2e, packaged MCP client trial):

```bash
npm run beta:check
```

`npm run beta:check` ends with `npm run beta:client-trial`, which installs the packed tarball in a temporary consumer repo and exercises MCP stdio transport end to end. That trial is an internal harness check, not an external benchmark superiority claim.

### Recorded transport fixture baseline (2026-06-13)

On the recorded fixture run dated **2026-06-13**, Grape produced the listed body-token and invalidation results under the documented harness limits. This table uses body token estimates from the context pack items. Serialized pack and serialized default MCP output token counts are diagnostics because JSON metadata, restore hints, and summaries can vary as the output contract changes.

| Field | Value |
|---|---|
| Command | `npm run bench` |
| Raw result file | `benchmarks/results/run-2026-06-13T12-24-54-222Z.json` |
| Git commit | `3666a37d9e526c0f267d9b53f6357272884f6ca6` |
| Package version | `1.0.0-beta.0` (packed tarball from git tree) |
| Node | `v22.18.0` on `darwin` |
| Fixtures | the six gated fixtures listed in this historical run |
| Limits | harness thresholds in this doc; zero unsafe omissions; zero stale sends |
| Caveats | local fixture results only; not proof of production savings or external tool superiority |

| Fixture | Turn 1 body tokens | Turn 2 body tokens | Turn 2 reduction | `OMIT_UNCHANGED` | `INVALIDATE_PREVIOUS` | Unsafe omissions | Stale sends |
|---|---:|---:|---:|---:|---:|---:|---:|
| `clean-typescript-app` | 2811 | 1663 | 50.4% | 7 | 1 | 0 | 0 |
| `branch-switch-typescript-app` | 2811 | 3440 | 0% | 0 | 9 | 0 | 0 |
| `stale-source-typescript-app` | 2811 | 3600 | 0% | 0 | 9 | 0 | 0 |
| `session-reset-typescript-app` | 3770 | 4947 | 0% | 0 | 9 | 0 | 0 |
| `polyglot-fallback-repo` | 3132 | 2523 | 31.46% | 7 | 1 | 0 | 0 |
| `monorepo-lite-repo` | 3388 | 1885 | 52.07% | 7 | 1 | 0 | 0 |

Allowed transport claim from this table: Grape works as a session-aware context transport layer on these fixtures. On the three no-change transport fixtures, the second same-session turn reduced body-token context by 31.46 percent to 52.07 percent with zero unsafe omissions and zero stale sends. Branch-switch, stale-source, and session-reset fixtures show stale context invalidation and safe full resend behavior, not token savings.

The current benchmark suite also includes `dirty-worktree-typescript-app`. That fixture is not part of the 2026-06-13 recorded table. It edits a tracked source file without committing it and expects turn 2 to report a dirty worktree, emit source-specific `INVALIDATE_PREVIOUS`, emit no `OMIT_UNCHANGED`, and report zero unsafe omissions and zero stale sends.

### Recorded published-package retrieval baseline (2026-06-13)

The post-beta harness compares the published registry package with naive and search baselines over three small cases. It measures file-level selection quality, known-noise ratios, and rough serialized output size. It does not prove token savings against naive or search baselines.

| Field | Value |
|---|---|
| Command | `npm run bench:post-beta` |
| Raw result file | `benchmarks/results/post-beta-2026-06-13T12-38-16-742Z-published-beta.json` |
| Artifact identity | `npm:grape-context@1.0.0-beta.0` |
| Package version | `1.0.0-beta.0` from npm registry |
| Search baseline | `rg` |
| Cases | `retrieval_monorepo`, `bugfix_discount`, `docs_beta_release` |
| Caveats | three cases on one machine; docs case uses a curated docs slice; file-level recall is primary; span checks are supplementary |

| Case | Mode | Naive recall / noise | Search recall / noise | Grape final-facing recall / noise | Size finding |
|---|---|---|---|---|---|
| `retrieval_monorepo` | uncapped | 0.67 / 0.33 | 1 / 0 | 1 / 0 | Grape serialized output was larger than naive |
| `retrieval_monorepo` | budgeted | 0.67 / 0.33 | 1 / 0 | 1 / 0 | Grape used the full budget and was larger than naive |
| `bugfix_discount` | uncapped | 1 / 0 | 1 / 0 | 1 / 0 | Grape serialized output was larger than naive |
| `bugfix_discount` | budgeted | 1 / 0 | 1 / 0 | 1 / 0 | Grape used the full budget and was larger than naive |
| `docs_beta_release` | uncapped | 1 / 0.125 | 1 / 0.125 | 1 / 0.125 | Grape selected the legacy alpha README as known noise |
| `docs_beta_release` | budgeted | 1 / 0.125 | 1 / 0.125 | 1 / 0.125 | Grape selected the legacy alpha README as known noise |

Token reduction thresholds apply to no-change transport fixtures: `clean-typescript-app`, `polyglot-fallback-repo`, and `monorepo-lite-repo`. Invalidation benchmarks require `INVALIDATE_PREVIOUS > 0` on turn 2 with zero unsafe omissions and zero stale sends. The session-reset benchmark also requires `NEW > 0` and `OMIT_UNCHANGED = 0` on the reset turn to prove the agent receives a safe full resend instead of a no-change omission.

Current benchmark thresholds:

- first-turn overhead must be no more than 10 percent above naive resend
- first-turn serialized agent-output overhead must be no more than 400 percent above naive resend
- second-turn reduction must be at least 30 percent (internal CI harness threshold on gated no-change fixtures; not a user-facing savings claim)
- second-turn `.grape/` byte growth must stay under 5 MB on gated no-change fixtures
- no-change fixture turn 2 full compile duration must stay at or below 2x turn 1 full compile duration
- unsafe omissions must be zero
- stale items sent must be zero
- second turn must include at least one `OMIT_UNCHANGED`
- second turn must include at least one `RESTORE_AVAILABLE`

Benchmark output also reports serialized context-pack token estimates, serialized default agent-output token estimates, and token breakdowns by diff state and section. These are transport diagnostics: body-token counts explain logical context savings, serialized-pack counts show JSON overhead from metadata, restore hints, and dependency references, and serialized-agent-output counts estimate the default MCP `agent_pack` frame including compact text summary and compact preview structured content.

Benchmark output also reports storage footprint diagnostics per turn. Storage bytes are measured from the temporary fixture workspace after each compile. The repeated-turn growth threshold catches obvious fixture regressions, but it is not a general production storage claim.

Benchmark output also reports the `noChangeSync` gate on no-change fixtures. This is a repeated-turn fixture check over full compile duration, not proof of fixed production sync latency.

These numbers are deterministic approximate token estimates from named fixtures. They are valid as local harness checks because they fail on unsafe omission or stale send counters. They are not proof of production token savings or external tool superiority.

The current benchmark harness is ready for internal sanity checks, not external claims against Composer or Graphify. Official release benchmarking must add comparable scripted scenarios, publish sanitized raw results, and label fixture, command, date, and limits.

## Metric Schema

```ts
interface BenchmarkTurnMetric {
  fixture: string;
  taskId: string;
  turn: number;
  dirtyWorktree: boolean;
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
  storageFootprint: {
    grapeBytes: number;
    databaseBytes: number;
    databaseWalBytes: number;
    databaseShmBytes: number;
    artifactBytes: number;
    artifactJsonBytes: number;
    artifactMarkdownBytes: number;
    artifactRepositoryBytes: number;
    artifactOtherBytes: number;
    otherBytes: number;
  };
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
    inputRefs: string[];
    bodyTokens: number;
    serializedTokens: number;
  }>;
}
```

Token-reduction benchmark JSON also includes:

```ts
interface NoChangeSyncBenchmarkGate {
  benchmark: "bench_no_change_sync_time";
  status: "pass" | "fail";
  thresholds: {
    maxSecondTurnDurationRatio: number;
    requireCleanSecondTurn: true;
    requireSecondTurnOmission: true;
    requireZeroUnsafeOmissions: true;
    requireZeroStaleItemsSent: true;
  };
  firstTurnDurationMs: number;
  secondTurnDurationMs: number;
  secondTurnDurationRatio: number;
  secondTurnOmittedItemCount: number;
  secondTurnRestoreAvailableCount: number;
  secondTurnDirtyWorktree: boolean;
  failures: string[];
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
- Later-turn token reduction and no-change full-turn duration ratio are measured on the no-change fixtures above. Invalidation behavior is gated on the branch-switch, dirty-worktree, stale-source, and session-reset fixtures. Broader gold-label fixtures and isolated sync-time fixtures in the metrics table below are not yet bench-gated.

## Required Benchmark Names

- `bench_token_reduction_after_first_turn`
- `bench_diff_vs_naive_resend`
- `bench_no_change_sync_time`
- `bench_changed_file_invalidation_time`
- `bench_current_valid_gold_labels`
- `bench_compression_invalidation`
- `bench_session_lock_collision`
- `bench_restore_omitted_item`
