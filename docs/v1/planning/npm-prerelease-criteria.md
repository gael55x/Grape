# npm prerelease decision criteria

Grape uses this checklist before recommending an npm **prerelease** (not stable `1.0.0`).

## Required gates (all must pass)

1. `npm run check` on clean tree
2. `npm run beta:check` (`check`, `benchmark:run`, `e2e:alpha`, `beta:client-trial`)
3. Packed tarball install smoke (`install:check`)
4. MCP stdio smoke from installed package (`beta:client-trial`)
5. Cross-platform CI green on Ubuntu, macOS, Windows (hosted)
6. Zero unsafe omissions / zero stale sends on gated benchmark fixtures
7. Changelog + version bump approved
8. No undocumented behavior delta between `main` and published package without version bump

## Strongly recommended before beta dist-tag

1. At least one **human** MCP client trial recorded (`beta-trial-checklist.md`)
2. Comparative benchmark report with baselines + capability matrix (`benchmark-readiness-report.md`)
3. `npm run bench` + `bench:summary` on release candidate commit
4. Post-publish `global:smoke` on new version

## Does not block beta prerelease

- Full external comparator suite (Graphify/chum-mem/agentmemory partial runs)
- Embedding-only baseline
- Gold-label current-valid benchmark at 95% threshold
- Semantic retrieval / embeddings
- Stable `1.0.0` marketing

## Prerelease version policy

- Prefer the `beta` dist-tag when transport contract is frozen per `transport-stability.md`
- Otherwise `0.x` beta with `beta` dist-tag
- Never republish an existing version
- Never claim stable `1.0.0` from benchmark evidence alone

## Claim boundaries at publish

**May claim:** session-safe context transport, local MCP/CLI, named fixture proof, invalidation/restore on recorded scenarios.

**May not claim:** beats Graphify/Mem0/Composer; broad polyglot graph intelligence; full memory platform; IDE integration without human trial proof.
