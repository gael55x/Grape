# V1 Fixture Documentation

This folder documents fixture repositories used by tests and benchmarks.

Actual fixture repos live under `tests/fixtures/`.

## Required Metadata

Each fixture must document:

- purpose
- files and branches
- expected claims
- expected proofs
- expected scope matches
- expected stale items
- expected token baseline
- benchmark usage

## Agent Rule

Agents must not add benchmarks against undocumented fixtures.

## Documented Fixtures

- [clean-typescript-app](clean-typescript-app.md): baseline token-reduction benchmark
- `branch-switch-typescript-app`: branch-switch invalidation benchmark (metadata under `tests/fixtures/`)
- `stale-source-typescript-app`: dependency-stale invalidation benchmark (metadata under `tests/fixtures/`)
- `session-reset-typescript-app`: explicit session-reset invalidation benchmark (metadata under `tests/fixtures/`)
- `polyglot-fallback-repo`: behavior proof fixture for unsupported-language lexical/path fallback
- `monorepo-lite-repo`: behavior proof fixture for explicit nested-package source/test scoping

## Fixture Matrix

| Fixture | Purpose | Status |
|---|---|---|
| `clean-typescript-app` | baseline clean repo; two-turn `OMIT_UNCHANGED` token reduction | **implemented**: `grape bench --fixture clean-typescript-app` |
| `branch-switch-typescript-app` | `INVALIDATE_PREVIOUS` after explicit session reuses a feature branch | **implemented**: `grape bench --fixture branch-switch-typescript-app` |
| `stale-source-typescript-app` | `INVALIDATE_PREVIOUS` after depended-on source bytes change | **implemented**: `grape bench --fixture stale-source-typescript-app` |
| `session-reset-typescript-app` | `INVALIDATE_PREVIOUS` plus full resend after `--reset-session` / `resetSession: true` | **implemented**: `grape bench --fixture session-reset-typescript-app` |
| `dirty-worktree-repo` | dirty facts are worktree-scoped | planned |
| `stale-proof-repo` | proof hashes invalidate dependents | planned |
| `ignored-files-secrets-repo` | privacy and redaction rules | planned (partial coverage in unit/behavior tests) |
| `no-tests-repo` | missing verification surfaced honestly | planned |
| `dynamic-imports-repo` | partial graph confidence | planned |
| `monorepo-lite-repo` | explicit `packages/api/...` path scoping and package-local related TS test selection | **implemented behavior fixture**, not a `grape bench` scenario yet |
| `polyglot-fallback-repo` | common-language safe exact/path/lexical fallback with explicit Markdown path evidence and partial-context warnings | **implemented behavior fixture**, not a `grape bench` scenario yet |
| `auth-security-fixture` | high-risk exact context | planned (risk-overlay behavior is covered in behavior tests) |
| `compression-invalidation-fixture` | compression invalidation | planned |
| `session-reset-fixture` | full resend and restore | implemented as `session-reset-typescript-app`; restore remains covered in behavior tests and restore-path goldens |
| `parallel-agents-fixture` | session isolation | planned |

## What `grape bench` validates today

| Fixture | Benchmark id | Checks |
|---|---|---|
| `clean-typescript-app` | `bench_token_reduction_after_first_turn` | two-turn compile; `OMIT_UNCHANGED` + `RESTORE_AVAILABLE`; token reduction threshold; zero unsafe omissions |
| `branch-switch-typescript-app` | `bench_branch_switch_invalidation` | turn 2 on `feature/context` emits `INVALIDATE_PREVIOUS`; zero unsafe omissions |
| `stale-source-typescript-app` | `bench_stale_source_invalidation` | turn 2 after source edit emits `INVALIDATE_PREVIOUS`; zero unsafe omissions |
| `session-reset-typescript-app` | `bench_diff_vs_naive_resend` | turn 2 with reset emits `INVALIDATE_PREVIOUS`, sends new current context, and emits no `OMIT_UNCHANGED`; zero unsafe omissions |

`grape bench` picks the scenario from the fixture name. It does **not** yet run gold-label claim/proof checks or the full planned matrix below.

`polyglot-fallback-repo` and `monorepo-lite-repo` are checked-in proof fixtures used by behavior tests. They are not benchmark baselines and should not be presented as Composer/Graphify/Grape benchmark results until scripted comparable scenarios are added.

## Fixture Metadata Template

```yaml
name:
purpose:
repo_shape:
branches:
important_files:
expected_claims:
expected_proofs:
expected_scope_results:
expected_warnings:
expected_invalidations:
token_baseline:
related_tests:
related_benchmarks:
```
