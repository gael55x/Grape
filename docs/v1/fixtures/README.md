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

Fixture files under `tests/fixtures/` are checked out with LF line endings through `.gitattributes`.
Their `grape-fixture.json` metadata stores byte hashes for those LF fixture bytes so `npm run fixtures:check` stays deterministic on Linux, macOS, and Windows.
Do not change runtime source hashing to compensate for fixture checkout differences.

## Documented Fixtures

- [clean-typescript-app](clean-typescript-app.md): baseline token-reduction benchmark
- `branch-switch-typescript-app`: branch-switch invalidation benchmark (metadata under `tests/fixtures/`)
- `dirty-worktree-typescript-app`: uncommitted source-edit invalidation benchmark (metadata under `tests/fixtures/`)
- `stale-source-typescript-app`: dependency-stale invalidation benchmark (metadata under `tests/fixtures/`)
- `session-reset-typescript-app`: explicit session-reset invalidation benchmark (metadata under `tests/fixtures/`)
- `polyglot-fallback-repo`: behavior proof fixture and no-change token benchmark for unsupported-language lexical/path fallback
- `monorepo-lite-repo`: behavior proof fixture and no-change token benchmark for explicit nested-package source/test scoping

## Fixture Matrix

| Fixture | Purpose | Status |
|---|---|---|
| `clean-typescript-app` | baseline clean repo; two-turn `OMIT_UNCHANGED` token reduction | **implemented**: `grape bench --fixture clean-typescript-app` |
| `branch-switch-typescript-app` | `INVALIDATE_PREVIOUS` after explicit session reuses a feature branch | **implemented**: `grape bench --fixture branch-switch-typescript-app` |
| `dirty-worktree-typescript-app` | `INVALIDATE_PREVIOUS` after a tracked source file changes without a commit | **implemented**: `grape bench --fixture dirty-worktree-typescript-app` |
| `stale-source-typescript-app` | `INVALIDATE_PREVIOUS` after depended-on source bytes change | **implemented**: `grape bench --fixture stale-source-typescript-app` |
| `session-reset-typescript-app` | `INVALIDATE_PREVIOUS` plus full resend after `--reset-session` / `resetSession: true` | **implemented**: `grape bench --fixture session-reset-typescript-app` |
| `stale-proof-repo` | proof hashes invalidate dependents | planned |
| `ignored-files-secrets-repo` | privacy and redaction rules | planned (partial coverage in unit/behavior tests) |
| `no-tests-repo` | missing verification surfaced honestly | planned |
| `dynamic-imports-repo` | partial graph confidence | planned |
| `monorepo-lite-repo` | explicit `packages/api/...` path scoping and package-local related TS test selection | **implemented**: behavior tests and `grape bench --fixture monorepo-lite-repo` |
| `polyglot-fallback-repo` | common-language safe exact/path/lexical fallback with explicit Markdown path evidence and partial-context warnings | **implemented**: behavior tests and `grape bench --fixture polyglot-fallback-repo` |
| `auth-security-fixture` | high-risk exact context | planned (risk-overlay behavior is covered in behavior tests) |
| `compression-invalidation-fixture` | compression invalidation | planned |
| `session-reset-fixture` | full resend and restore | implemented as `session-reset-typescript-app`; restore remains covered in behavior tests and restore-path goldens |
| `parallel-agents-fixture` | session isolation | planned |

## What `grape bench` validates today

| Fixture | Benchmark id | Checks |
|---|---|---|
| `clean-typescript-app` | `bench_token_reduction_after_first_turn` | two-turn compile; `OMIT_UNCHANGED` + `RESTORE_AVAILABLE`; token reduction threshold; zero unsafe omissions |
| `branch-switch-typescript-app` | `bench_branch_switch_invalidation` | turn 2 on `feature/context` emits `INVALIDATE_PREVIOUS`; zero unsafe omissions |
| `dirty-worktree-typescript-app` | `bench_dirty_worktree_invalidation` | turn 2 after an uncommitted tracked source edit reports dirty worktree, emits source-specific `INVALIDATE_PREVIOUS`, emits no `OMIT_UNCHANGED`, and has zero unsafe omissions or stale sends |
| `stale-source-typescript-app` | `bench_stale_source_invalidation`, `bench_changed_file_invalidation_time` | turn 2 after source edit emits `INVALIDATE_PREVIOUS`, reports changed-file duration, references the edited source in invalidation evidence, and has zero unsafe omissions |
| `session-reset-typescript-app` | `bench_diff_vs_naive_resend` | turn 2 with reset emits `INVALIDATE_PREVIOUS`, sends new current context, and emits no `OMIT_UNCHANGED`; zero unsafe omissions |
| `polyglot-fallback-repo` | `bench_token_reduction_after_first_turn` | fixture-owned task exercises Python fallback context, provider blind spots, two-turn `OMIT_UNCHANGED`, restore hints, and zero unsafe omissions |
| `monorepo-lite-repo` | `bench_token_reduction_after_first_turn` | fixture-owned task exercises package-local TS source/test context, two-turn `OMIT_UNCHANGED`, restore hints, and zero unsafe omissions |

`grape bench` picks the scenario from the fixture name and uses the fixture's `benchmarkTask` when `--task` is omitted. It does **not** yet run gold-label claim/proof checks or the full planned matrix below.

`polyglot-fallback-repo` and `monorepo-lite-repo` now run as internal Grape fixture benchmarks. They should not be presented as Composer, Graphify, or broad-language benchmark results until scripted comparable scenarios are added.

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
benchmarkTask:
```
