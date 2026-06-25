# Comparative Benchmark Design

## Value questions

| Question | How measured | Current status |
| --- | --- | --- |
| Context size vs naive full-context? | `naive-baseline.mjs` + `grape bench` turn metrics | Fixture estimate on `clean-typescript-app` |
| Repeated-session reduction via `OMIT_UNCHANGED`? | Turn-2 `grapeTokens` vs turn-1 on no-change fixtures | Beta fixture evidence when tied to a committed raw result file; not a production savings claim |
| Restore when context unchanged? | Turn-2 `RESTORE_AVAILABLE` + smoke scripts | Measured on named fixtures |
| Stale context rejected after file changes? | `stale-source-typescript-app`, `dirty-worktree-typescript-app`, `branch-switch-typescript-app` | Measured on named fixtures |
| Context useful for coding agents, not just smaller? | Task prompts + usefulness score (1-5) | Partial. Harness scores only; human or agent eval deferred |
| Value vs Graphify/chum-mem? | `run-comparator.mjs` + capability matrix | Partial. Current Graphify probe measures one-shot CLI orientation only when CLI is installed |
| Where competitors beat Grape on their wedge? | Competitor analysis in readiness report | Documented. Semantic memory, broad graphs, cloud scale |

## Correctness questions

| Question | Fixture / gate |
| --- | --- |
| Avoid stale source excerpts? | `stale-source-typescript-app` |
| Invalidate after branch change? | `branch-switch-typescript-app` |
| Dirty worktree handling? | `dirty-worktree-typescript-app`; `beta:client-trial` also edits one file | Fixture gate covers uncommitted source invalidation; broader dirty matrix deferred |
| Proof-backed claims preserved? | Behavior tests; not bench-gated |
| High-risk claims without evidence blocked? | Behavior tests (`auth-security` planned) |
| Secret/env leak avoidance? | `beta:client-trial` |
| External provenance/freshness? | Comparator runs mark N/A where unsupported |

## Performance questions

| Metric | Source |
| --- | --- |
| Compile/index time | `grape bench` `durationMs` per turn |
| No-change repeated-turn duration | `grape bench` `noChangeSync` gate on no-change fixtures |
| Changed-file invalidation duration | `grape bench` `changedFileInvalidation` gate on `stale-source-typescript-app` |
| Retrieval time | Not isolated in current harness |
| Artifact / payload size | `serializedPackTokens`, `serializedAgentOutputTokens` |
| P50/P95 | Requires repeated runs. Not yet automated |
| Setup time per tool | `run-comparator.mjs` `setupMinutes` |
| Persistent services | Recorded per comparator (`runtime_dependencies`) |

## Release questions

| Question | Gate |
| --- | --- |
| Tarball install clean? | `npm run install:check` |
| CLI from tarball? | `install:check`, `e2e:alpha` |
| MCP stdio from tarball? | `beta:client-trial` |
| Package contents correct? | `package:check` |
| Beta npm prerelease justified? | Historical transport gates in [`benchmark-readiness-report.md`](../docs/v1/legacy/alpha/benchmark-readiness-report.md); current post-beta comparison files under `benchmarks/results/post-beta-*` |
| Honest positioning? | Capability matrix + competitor docs |

## Baselines

| Target | Description |
| --- | --- |
| A | Local packed tarball (`npm pack`, then consumer install) |
| B | Published beta tarball from `e2e:alpha` or registry `@beta` / `latest` |
| C | Naive full-context (`naive-baseline.mjs`) |
| D | Manual `rg` keyword selection |
| E | Embedding-only | Deferred. Requires LLM or API; not in fast path |
| F | Graphify | `run-comparator.mjs` when `graphify` CLI present |
| G | chum-mem | Docker stack; manual per `comparators/chum-mem.md` |
| H | Others | Capability matrix unless runnable |

## Task prompts (usefulness evaluation)

1. Find the source of this failing test and propose the smallest fix.
2. Explain how this CLI command reaches the session ledger.
3. Find the code path responsible for stale context invalidation.
4. Identify whether this source excerpt is still current after the branch change.
5. Summarize the package root and workspace scope for this task.

Score 0–5 per [`benchmarks/README.md`](README.md). Harness assigns 4 for passing transport fixtures; human dual-review deferred.

## Reproducibility

Every `run-*.json` includes:

- `gitCommit`, `grapePackageVersion`, `nodeVersion`, `npmVersion`, `platform`, `capturedAt`

Cold vs warm: current harness uses fresh temp repos per fixture. The `bench_no_change_sync_time` gate compares turn 2 full compile duration with turn 1 full compile duration inside that copied fixture. It is not an isolated warm-cache filesystem sync benchmark.

Changed-file timing: `bench_changed_file_invalidation_time` runs inside the stale-source fixture after one tracked source edit. It measures the full turn 2 compile path and source-specific invalidation evidence, not isolated `grape sync` latency.

## Invalid comparisons to avoid

- Token reduction vs Graphify from the current comparator. It does not measure Graphify's MCP, update, hook, IDE, or multi-turn assistant workflow.
- Proof coverage vs Mem0 (different trust model)
- MCP transport vs LangChain memory module (not a product)
- Source checkout `grape bench` vs npm-installed competitor without labeling target

## Future fair Graphify comparator

The current Graphify probe is useful only for structural orientation. It runs `graphify update` and a single `graphify query` against a fixture graph. It must not be described as a full Graphify product comparison.

A fair multi-turn comparator should use the same repo and task across both tools and include:

- first context request
- second same-session continuation
- mid-session source edit
- branch or dependency change
- task wording drift
- omitted context restore or equivalent recovery path
- high-risk auth, security, payments, data deletion, or deployment task

Measure stale assumptions, unnecessary rereads, token volume, context correctness, agent success, and recovery quality. Do not claim that Grape beats Graphify broadly unless that scenario has committed, reproducible evidence.
