# Grape Comparative Benchmarks

This directory holds the comparative benchmark harness for Grape. It is separate from product code under `src/`.

## Goals

Grape includes benchmark fixtures and scripts for local comparison.

The harness measures transport behavior (omission, invalidation, restore) on named fixtures. It also compares against fair baselines (naive full context, manual `rg`, packed tarball install) and records partial external comparator runs where installable (Graphify orientation, chum-mem when Docker available).

## What this is not

- Not marketing benchmark claims
- Not proof that Grape beats Graphify, Mem0, or Composer
- Not a substitute for `npm run check` or `npm run beta:check`

## Layout

```text
benchmarks/
  README.md                 # this file
  design.md                 # methodology and benchmark questions
  comparators/              # per-tool comparator notes
  fixtures/manifest.json    # scenario manifest (maps to tests/fixtures/)
  scripts/
    run-benchmarks.mjs      # Grape fixture + baseline orchestrator
    run-comparator.mjs      # external tool probes (skips when unavailable)
    summarize-results.mjs     # latest JSON to markdown summary
    naive-baseline.mjs        # naive + rg baseline for one fixture
  results/                  # generated JSON (gitignored except post-beta-*.json)
```

Fixture **source trees** live under `tests/fixtures/`. The manifest describes post-beta case intent; `npm run benchmark:run` remains the CI gate for the six core transport fixtures.

## Commands

From repo root:

```bash
npm run bench:post-beta        # published npm package vs naive/search/grape baselines
npm run bench:post-beta:local  # local packed candidate (post-fix comparison only)
npm run bench                  # beta candidate transport: npm pack + install from git tree
npm run bench:summary          # summarize latest results/
npm run bench:comparators      # probe external tools (skips unavailable)
node benchmarks/scripts/naive-baseline.mjs clean-typescript-app
```

`npm run bench:post-beta` installs `grape-context` from the npm registry into a fresh consumer workspace and records `artifactIdentity: npm:grape-context@1.0.0-beta.0`. `npm run bench:post-beta:local` installs a packed tarball from the current git commit for before/after comparison.

The uncapped mode measures maximum recall. The budgeted mode caps each baseline to the same case budget so the benchmark can compare context selection under equal pressure.

`npm run bench` is the **beta candidate transport** path: it does **not** benchmark the published registry package and does **not** use the dev source-checkout CLI unless you pass `--include-dev-source`.

Full beta gate (unchanged):

```bash
npm run beta:check
```

## Comparator fairness rules

1. Mark dimensions as **not applicable** when a tool does not target that capability (session diff, restore tokens, proof-backed claims, MCP transport).
2. Do not optimize Grape before collecting the first baseline on a branch.
3. Record environment metadata (git commit, package version, Node, OS) on every run.
4. Separate **local source checkout** runs from **packed tarball** runs (`npm run e2e:alpha`, `npm run install:check`).

See [`../../../docs/v1/legacy/alpha/benchmark-readiness-report.md`](../../../docs/v1/legacy/alpha/benchmark-readiness-report.md).
