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

- [clean-typescript-app](clean-typescript-app.md) — the only fixture with committed docs and a wired `grape bench` path today

## Fixture Matrix (aspirational)

The table below is the target corpus for future tests and benchmarks. Only `clean-typescript-app` is implemented and exercised by `grape bench` today.

| Fixture | Purpose | Status |
|---|---|---|
| `clean-typescript-app` | baseline clean repo for sync, index, compile, no-change diff | **implemented** — `tests/fixtures/clean-typescript-app`, `grape bench --fixture clean-typescript-app` |
| `dirty-worktree-repo` | dirty facts are worktree-scoped | planned |
| `branch-switch-repo` | branch-invalid claims excluded | planned (branch-switch behavior is covered in behavior tests on ephemeral repos) |
| `stale-proof-repo` | proof hashes invalidate dependents | planned |
| `ignored-files-secrets-repo` | privacy and redaction rules | planned (partial coverage in unit/behavior tests) |
| `no-tests-repo` | missing verification surfaced honestly | planned |
| `dynamic-imports-repo` | partial graph confidence | planned |
| `monorepo-lite-repo` | package/path boundaries | planned |
| `auth-security-fixture` | high-risk exact context | planned (risk-overlay behavior is covered in behavior tests) |
| `compression-invalidation-fixture` | compression invalidation | planned |
| `session-reset-fixture` | full resend and restore | planned (covered in behavior tests on ephemeral repos) |
| `parallel-agents-fixture` | session isolation | planned |

## What `grape bench` validates today

Against `clean-typescript-app` only:

- two-turn compile/diff on a copied temporary Git workspace
- second-turn `OMIT_UNCHANGED` count greater than zero
- restore-available metadata on the second turn
- zero unsafe omissions and zero stale items sent on the happy path
- second-turn token reduction above the configured benchmark threshold
- deterministic JSON benchmark report fields (`benchmark`, `fixture`, `status`, `turns`, `failures`)

It does **not** yet run the full matrix above, gold-label claim/proof checks, or multi-fixture regression suites.

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
