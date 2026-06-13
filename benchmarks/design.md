# Comparative Benchmark Design

## Value questions

| Question | How measured | Current status |
| --- | --- | --- |
| Context size vs naive full-context? | `naive-baseline.mjs` + `grape bench` turn metrics | Fixture estimate on `clean-typescript-app` |
| Repeated-session reduction via `OMIT_UNCHANGED`? | Turn-2 `grapeTokens` vs turn-1 on no-change fixtures | Fixture estimate on named no-change fixtures when run locally; not an official release benchmark claim |
| Restore when context unchanged? | Turn-2 `RESTORE_AVAILABLE` + smoke scripts | Measured on named fixtures |
| Stale context rejected after file changes? | `stale-source-typescript-app`, `branch-switch-typescript-app` | Measured on named fixtures |
| Context useful for coding agents, not just smaller? | Task prompts + usefulness score (1-5) | Partial. Harness scores only; human or agent eval deferred |
| Value vs Graphify/chum-mem? | `run-comparator.mjs` + capability matrix | Partial. Graphify orientation when CLI installed |
| Where competitors beat Grape on their wedge? | Competitor analysis in readiness report | Documented. Semantic memory, broad graphs, cloud scale |

## Correctness questions

| Question | Fixture / gate |
| --- | --- |
| Avoid stale source excerpts? | `stale-source-typescript-app` |
| Invalidate after branch change? | `branch-switch-typescript-app` |
| Dirty worktree handling? | `beta:client-trial` (single edit); full matrix **planned** |
| Proof-backed claims preserved? | Behavior tests; not bench-gated |
| High-risk claims without evidence blocked? | Behavior tests (`auth-security` planned) |
| Secret/env leak avoidance? | `beta:client-trial` |
| External provenance/freshness? | Comparator runs mark N/A where unsupported |

## Performance questions

| Metric | Source |
| --- | --- |
| Compile/index time | `grape bench` `durationMs` per turn |
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
| Beta npm prerelease justified? | Historical transport gates in [`benchmark-readiness-report.md`](../docs/v1/legacy/alpha/benchmark-readiness-report.md); formal benchmark comparison is the next validation phase |
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

Cold vs warm: current harness uses fresh temp repos per fixture (cold compile). Warm-cache benches are **planned** (`bench_no_change_sync_time`).

## Invalid comparisons to avoid

- Token reduction vs Graphify (no session diff)
- Proof coverage vs Mem0 (different trust model)
- MCP transport vs LangChain memory module (not a product)
- Source checkout `grape bench` vs npm-installed competitor without labeling target
