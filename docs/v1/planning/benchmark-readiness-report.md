# Grape Comparative Benchmark Readiness Report

> **Run date:** 2026-06-13  
> **Branch:** `benchmark/beta-1-readiness`  
> **Author:** Gaille Amolong

## 1. Executive verdict

**Transport and docs may support a `1.0.0-beta.0` npm prerelease when `npm run beta:check` passes and the version bump is approved.** Not production-ready. Not benchmark-marketing-ready.

**Official benchmark marketing claims are not ready.** Do not claim proven token savings, external tool superiority, or production readiness from the current local fixture runs.

**Competitive position:** mixed

Grape has scripted harness evidence of its transport wedge (session diff, invalidation, restore, privacy smoke, packaged MCP) on six internal fixtures with zero unsafe omissions and zero stale sends. It does not yet have human IDE MCP trials, task-based usefulness evaluation with independent reviewers, or fair multi-tool comparative numbers beyond a single Graphify orientation run. First-turn default MCP `agent_pack` serialized overhead remains high (about 3x body tokens on turn 1), which weakens any "smaller context" story before usefulness is scored.

## 2. Tested versions

**Primary benchmark target:** current **beta candidate** from `npm pack` plus install from the current git tree, exercised through the **installed** `grape` binary (`grape-beta-candidate-tarball`). This is the prerelease artifact under test, not necessarily the last registry-installed package.

| Item | Value |
| --- | --- |
| Beta candidate git commit | `b93d34092c1aeaed102756f4aa5e5f169a24d27c` |
| Branch | `benchmark/beta-1-readiness` |
| Beta candidate tarball | `grape-context-0.1.0-alpha.3.tgz` (packed from current tree at commit above) |
| Installed-from-tarball version label | `0.1.0-alpha.3` (`package.json` not bumped yet) |
| Published npm alpha (reference only, **not** primary target) | `0.1.0-alpha.3` @ tag `v0.1.0-alpha.3` (`802e07f`) |
| Commits on branch since published alpha.3 tag | **147** commits (`git log v0.1.0-alpha.3..HEAD`). Beta candidate includes unreleased post-alpha.3 work |
| Graphify | `0.7.15` (local CLI, orientation comparator) |
| chum-mem / agentmemory / others | not run (see §11) |
| Node | `v22.18.0` |
| npm | `11.5.2` |
| OS | darwin arm64, 16 GB RAM |
| MCP smoke (beta candidate tarball) | `npm run beta:client-trial` pass on 2026-06-13 |
| CI reference | GitHub Actions run `27460794736` (cross-platform `check` + `beta-smoke`) |

**Important:** The version string still reads `alpha.3` until an approved version bump. Benchmark evidence in this report is from the **packed beta candidate at `b93d340`**, not from `npm install -g grape-context@0.1.0-alpha.3` on the registry.

## 3. Review summary

| Perspective | Key finding | Risk | Release impact | Confidence |
| --- | --- | --- | --- | --- |
| Product and positioning | Grape owns session-safe context **transport**, not memory/RAG | Users expect “memory platform” | Must not market as Mem0/Zep competitor | high |
| Benchmark methodology | Internal fixtures are sound; external parity missing | Overclaiming token wins | Blocks beta marketing claims | high |
| Competitor research | Graphify/chum-mem/agentmemory are partial peers; Mem0/Zep are adjacent | Forcing unfair comparisons | Use capability matrix | high |
| Grape architecture | Real compile, ledger, and diff pipeline; manifest lists 12 scenarios, 6 gated | Manifest drift | Document harness mapping | medium |
| Retrieval and correctness | Invalidation/restore proven; gold-label bench missing | False confidence on broad repos | Defer broad claims | medium |
| Transport, MCP, npm | `beta:client-trial` + `install:check` pass; no human IDE trial | IDE integration unproven | Blocks beta label | high |
| Privacy and security | `beta:client-trial` leak checks pass | Limited dirty-worktree matrix | Accept for transport beta only | medium |
| Measurement integrity | Environment captured in JSON; source-checkout bench labeled | Tarball vs source confusion | Label targets in reports | high |
| Documentation and release claims | Docs already forbid Composer/Graphify superiority | Hype creep | Follow `npm-prerelease-criteria.md` | high |
| Adversarial review | Turn-1 agent_pack overhead dwarfs Graphify query payload; not comparable | “Grape is smaller” narrative | Do not compare raw tokens across tools | high |

## 4. Competitor selection

| Tool | Category | Included? | Reason |
| --- | --- | --- | --- |
| Graphify | Direct/near-direct (repo context map) | Partial bench | Installed; orientation query on shared fixture |
| chum-mem | Direct/near-direct (PCKC memory) | Matrix + manual | Docker/GPL; trust peer not transport peer |
| agentmemory | Direct/near-direct (coding-agent memory) | Skipped | Server not installed in this run |
| Graphiti | Adjacent (temporal KG) | Matrix only | LLM + graph DB |
| Mem0 | Adjacent (agent memory) | Matrix only | Cloud/vector deps |
| Cognee | Adjacent (KG memory platform) | Matrix only | Cognify pipeline |
| Zep | Adjacent (managed memory) | Matrix only | Cloud-primary |
| Letta | Adjacent (agent platform) | Matrix only | Different product shape |
| LangChain / LlamaIndex memory | Framework primitives | Excluded | Not installable products |
| Naive full-context | Baseline | Yes | Grape `naiveTokens` on fixture |
| Manual rg | Baseline | Partial | `rg` failed silently in harness (no matches path) |
| Published Grape alpha.3 | Baseline | Same version | No delta to compare until version bump |

## 5. Capability matrix

| Dimension | Grape | Graphify | chum-mem | agentmemory | Graphiti | Mem0 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Coding repo awareness | yes | yes | partial | partial | partial | partial | Grape: TS/JS AST + fallback |
| Project indexing | yes | yes | yes | yes | yes | yes | |
| Session diff transport | yes | not applicable | not applicable | not applicable | not applicable | not applicable | Grape differentiator |
| Restore/reuse semantics | yes | not applicable | partial | partial | not applicable | partial | |
| Stale-context invalidation | yes | partial | partial | partial | yes | partial | Grape: branch/commit/worktree deps |
| Proof-backed claims | partial | not applicable | yes | no | partial | no | Grape: narrow claim set |
| Source provenance | yes | partial | yes | partial | partial | partial | |
| Dirty worktree awareness | partial | not applicable | partial | not applicable | not applicable | not applicable | Conservative resend |
| Branch/commit scope | yes | not applicable | partial | not applicable | partial | not applicable | |
| Secret/privacy filtering | yes | not verified | not verified | not verified | not verified | not verified | Grape: beta trial asserts |
| MCP support | yes | partial | yes | yes | partial | yes | |
| CLI usability | yes | yes | partial | partial | partial | partial | |
| Local-first operation | yes | yes | partial | yes | partial | partial | |
| Package install quality | yes | yes (pip) | no npm | yes (npm) | partial | partial | chum-mem: Docker |
| Token reduction | measured | not applicable | not measured | not measured | not applicable | not applicable | Grape internal fixtures |
| Retrieval usefulness | partial | partial (orientation) | not measured | not measured | not measured | not measured | Human eval deferred |
| Setup complexity | low | low | high | medium | high | medium | |
| Operational dependencies | sqlite | none | postgres/chroma/docker | sqlite (default) | neo4j/falkordb+llm | vector+optional cloud | |

## 6. Benchmark scenarios

| Fixture ID | Source | Tested by |
| --- | --- | --- |
| small-js / medium-ts | `clean-typescript-app` | `npm run bench`, `benchmark:run` |
| workspace | `monorepo-lite-repo` | `benchmark:run` |
| polyglot-fallback | `polyglot-fallback-repo` | `benchmark:run` |
| branch-invalidation | `branch-switch-typescript-app` | `benchmark:run` |
| stale-source | `stale-source-typescript-app` | `benchmark:run` |
| session-reset | `session-reset-typescript-app` | `benchmark:run` |
| dirty-worktree | planned | `beta:client-trial` (single edit only) |
| privacy-secrets | harness | `beta:client-trial` |
| test-failure-spans | behavior tests | not bench-gated |
| mcp-smoke | harness | `beta:client-trial`, `install:check` |
| package-install | harness | `install:check`, `e2e:alpha` |
| competitor-compatible | `clean-typescript-app` | Graphify orientation |

## 7. Results summary

| Scenario | Target | Full baseline tokens | Tool payload T1 | Tool payload T2 | Omission % | Stale | Secret leaks | Usefulness | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| clean-typescript-app | grape-beta-candidate-tarball | 3353 | 2811 | 1663 | 50.4 | 0 | 0 | 4 | pass |
| branch-switch | grape-beta-candidate-tarball | 2850 | 2811 | 3440 | 0 | 0 | 0 | 4 | pass |
| stale-source | grape-beta-candidate-tarball | 3014 | 2811 | 3600 | 0 | 0 | 0 | 4 | pass |
| session-reset | grape-beta-candidate-tarball | 4327 | 3770 | 4947 | 0 | 0 | 0 | 4 | pass |
| polyglot-fallback | grape-beta-candidate-tarball | 3681 | 3132 | 2523 | 31.5 | 0 | 0 | 4 | pass |
| monorepo-lite | grape-beta-candidate-tarball | 3933 | 3388 | 1885 | 52.1 | 0 | 0 | 4 | pass |
| clean-typescript-app | graphify | n/a | n/a | 125 (query) | n/a | n/a | n/a | 3 | pass (orientation) |

**Note:** Grape turn-2 **body** omission is meaningful (about 50 percent on clean-typescript-app). Serialized default MCP `agent_pack` estimates are **larger** than turn-1 body on turn 2 due to cumulative structured metadata. Treat that as transport diagnostics, not external comparison tokens.

## 8. Performance summary

| Scenario | Tool | setup_min | index_ms | retrieval_ms | payload_ms | artifact_bytes | payload_bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| clean-typescript-app | grape-beta-candidate | ~0 | 892 | n/a | ~842 | n/a | ~6652 (T2 body est.) |
| clean-typescript-app | graphify | ~0 | 471 | 314 | n/a | 4077 | 497 |

## 9. Correctness summary

| Check | Result |
| --- | --- |
| Restore correctness | pass. `RESTORE_AVAILABLE` on no-change fixtures; smoke restore paths |
| Invalidation correctness | pass. branch, stale source, reset fixtures |
| Dirty worktree | partial. trial covers one unstaged edit |
| Branch/scope | pass. branch-switch fixture |
| Proof-backed claims | partial. behavior tests, not bench-gated |
| High-risk gating | partial. behavior tests only |
| Privacy/secret | pass. `beta:client-trial` |
| Source provenance | pass on fixtures with exact-source sections |
| External frameworks | Graphify: no session invalidation; others not run |

## 10. CLI/MCP/npm install summary

| Check | Result |
| --- | --- |
| Tarball pack | pass |
| Tarball install (`install:check` via `npm run check`) | pass (in full check) |
| CLI smoke | pass |
| MCP stdio smoke | pass (`beta:client-trial`) |
| Real IDE client trial | **not recorded** |
| Package contents | 287 files, migrations in `dist/` |

## 11. Competitor-by-competitor analysis

### Graphify

- **Does well:** Fast local graph build (~471 ms), compact query payload (~125 est. tokens), strong repo orientation.
- **Overlaps:** Coding repo awareness, indexing, CLI, local-first.
- **Does not overlap:** Session diff, restore tokens, proof claims, MCP `grape_get_context`.
- **Measured:** index 471 ms, query 314 ms, graph.json 4077 bytes.
- **Fair comparison:** Orientation only. Graphify query is not equivalent to Grape session pack.
- **Learn:** Keep default MCP payload lean; graph orientation is cheap when scoped.

### chum-mem

- **Skipped:** Docker Compose + GPL-3.0.
- **Overlap:** PCKC trust, current-valid retrieval.
- **Learn:** Study proof-carrying claim workflows for future trust depth.

### agentmemory

- **Skipped:** Server not installed.
- **Overlap:** MCP coding-agent memory injection.
- **Learn:** Session recall UX without proof model.

### Mem0 / Cognee / Zep / Graphiti

- **Matrix only:** General/temporal memory; unfair to bench against Grape transport.

## 12. Comparison to Grape alpha

| Area | Status |
| --- | --- |
| Improved on `main` | Transport hardening, cross-platform CI, polyglot/monorepo fixtures, slimmer default `agent_pack` |
| Same as published alpha.3 | Package version unchanged |
| Could not compare | No version bump yet. `e2e:alpha` exercises the packed tree before registry publish |

## 13. Blockers found

### Must fix before beta npm prerelease

| Issue | Severity |
| --- | --- |
| No human MCP client trial recorded (`beta-trial-checklist.md`) | high |
| No independent task-usefulness evaluation (harness scores are not agent success) | high |
| Version/changelog cut + publish approval for post-alpha.3 deltas | high |

### Must fix before stable 1.0

| Issue | Severity |
| --- | --- |
| Gold-label current-valid benchmarks | medium |
| Full dirty-worktree fixture matrix | medium |
| Comparable Composer workflow baseline | medium |
| chum-mem/agentmemory partial benches when Docker/server available | low |

### Can defer after beta

| Issue | Severity |
| --- | --- |
| Embedding-only baseline | low |
| P50/P95 multi-run stats | low |
| Warm-cache sync timing benches | low |

## 14. Release recommendation

**Do not publish yet** (as `1.0.0-beta.0` or new beta dist-tag) until:

1. At least one human IDE MCP trial is recorded.
2. Version is bumped to capture `main` deltas since alpha.3 (if publishing those deltas).
3. Comparative report and `npm-prerelease-criteria.md` are reviewed.

If publishing after those gates: publish `1.0.0-beta.0` with the `beta` dist-tag when transport stability per `transport-stability.md` is acceptable. Do not claim stable `1.0.0` or benchmark-proven superiority from fixture runs alone.

**Stable `1.0.0` is not justified.**

---

## Commands run (this pass)

```bash
git checkout main && git pull --ff-only origin main
npm ci && npm run check && npm pack --dry-run
git checkout benchmark/beta-1-readiness
npm run bench              # beta candidate tarball
npm run bench:comparators
npm run bench:summary
npm run beta:client-trial
```

## Documentation privacy scan

No personal local paths, API keys, or machine-specific cache paths added to committed docs. External benchmark workspace referenced as neutral `<external-benchmark-workspace>` in existing docs.

## Known gaps

- `rg` baseline returned n/a in harness (pattern/path issue on fixture tree).
- Graphify writes `graphify-out/` under fixture (gitignored).
- Generated JSON under `benchmarks/results/` gitignored; `latest-summary.md` is regenerable.

## Fast vs full benchmark commands

| Command | Scope |
| --- | --- |
| `npm run benchmark:run` | Fast. six Grape fixtures only (about 15 s) |
| `npm run bench` | Medium. fixtures plus pack smoke plus baselines (about 15 s) |
| `npm run beta:check` | Full gate. check plus benchmarks plus e2e plus MCP trial (about 3+ min) |
| `npm run bench:comparators` | External tools. Graphify only when installed; others skipped |
