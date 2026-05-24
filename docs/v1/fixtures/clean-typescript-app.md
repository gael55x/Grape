# Clean TypeScript App

## Purpose

Baseline clean repository for In-Memory Context Loop sync, evidence, proof-backed claim, current-valid retrieval, context artifact, and no-change diff behavior.

## Repository Shape

- Path: `tests/fixtures/clean-typescript-app`
- Branch model: single clean `main` branch in test setup.
- Worktree state: clean.
- Runtime requirement: none. This fixture is static until the test harness is introduced.

## Important Files

| Path | Purpose |
|---|---|
| `src/calculateDiscount.ts` | Source span for deterministic claim/proof extraction. |
| `src/calculateDiscount.test.ts` | Test assertion evidence for expected behavior. |
| `.grape/rules.md` | Pinned project rules for context pack output. |
| `package.json` | Package identity fixture. |

## Expected Claim

```text
calculateDiscount returns the configured member discount for a positive subtotal and returns zero for non-positive subtotals.
```

This claim is eligible for durable persistence only when exact source and test proof hashes match the fixture metadata.

## Expected Proofs

- Source proof: `src/calculateDiscount.ts`
- Test proof: `src/calculateDiscount.test.ts`
- Rule proof: `.grape/rules.md`

## Expected Scope Results

| Scope | Expected result |
|---|---|
| branch `main` | `match` |
| clean worktree | `match` |
| unknown feature flags | `unknown`, not required for this fixture |
| dirty worktree | not part of this fixture |

## Expected Context Artifact Sections

- `task`
- `pinned_rule`
- `active_claim`
- `code_span`
- `test_span`

## Expected Diff Behavior

First turn:

- source/test/rule context uses `NEW` or `PINNED`
- pinned project rules are sent as `PINNED`

Second no-change turn:

- unchanged non-pinned source/test context may use `OMIT_UNCHANGED`
- omitted items must include restore metadata
- pinned project rules are resent

## Benchmark Use

- token reduction after first turn
- no-change sync time
- context artifact determinism
- restore omitted item success
