# V1 Fixture Documentation

This folder documents fixture repositories used by tests and benchmarks.

Actual fixture repos may live under `tests/fixtures/`.

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

## Required Fixture Matrix

| Fixture | Purpose | Branches/files | Expected labels | Benchmarks |
|---|---|---|---|---|
| `clean-typescript-app` | baseline clean repo for sync, index, compile, no-change diff | one main branch, app code, tests, config | clean worktree, verified code spans, deterministic artifact | token reduction, no-change sync, determinism |
| `dirty-worktree-repo` | prove dirty facts are worktree-scoped | modified tracked file, untracked file | dirty warning, no branch-global dirty claim | dirty scope tests |
| `branch-switch-repo` | prove branch-invalid claims are excluded | main and feature branches with conflicting config | `INVALIDATE_PREVIOUS` on branch mismatch | branch invalidation |
| `stale-proof-repo` | prove proof hashes invalidate dependents | changed source span after claim creation | stale proof, stale artifact, stale sent item | changed-file sync |
| `ignored-files-secrets-repo` | prove privacy and redaction rules | `.env`, ignored secret file, approved private file | blocked raw secret, scoped approval | security/redaction |
| `no-tests-repo` | prove missing verification is surfaced honestly | app code without tests | warning, no false test-backed claim | brownfield safety |
| `dynamic-imports-repo` | prove partial graph confidence | dynamic imports, framework magic | partial graph warning | current-valid coverage |
| `monorepo-lite-repo` | prove package/path boundaries | two packages, shared config | package-scoped context | path and retrieval |
| `auth-security-fixture` | prove high-risk exact context | auth middleware, permissions test, config | exact spans, pinned rules | high-risk compile |
| `compression-invalidation-fixture` | prove compression is invalidated | stable symbols then changed input | stale compression invalidated | compression benchmark |
| `session-reset-fixture` | prove full resend and restore behavior | two turns, reset, restore request | no unsafe omission after reset | diff/restore |
| `parallel-agents-fixture` | prove session isolation | two agent sessions, concurrent requests | separate ledgers, lock behavior | concurrency |

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
