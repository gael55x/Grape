# Contributing

Grape is not ready for broad feature work yet. Contributions must first preserve the implementation discipline described in `docs/v1/`.

## Required Reading

Before changing production code, read:

1. `AGENTS.md`
2. `docs/v1/README.md`
3. `docs/v1/INVARIANTS.md`
4. `docs/v1/STATE_MACHINE.md`
5. The domain document for the code you intend to touch

## Change Requirements

- Every state transition needs a documented transition and tests.
- Every schema change needs a migration, storage docs, and migration tests.
- Every trust rule needs Trust Model and invariant tests.
- Every context artifact field needs artifact docs and golden tests.
- Every MCP or CLI contract change needs docs and contract/snapshot tests.
- Every benchmark claim needs a named fixture and scripted naive baseline.

## Commit Style

Use Conventional Commits:

- `docs: add v1 state machine`
- `test: cover proof hash invalidation`
- `feat: add repo snapshot preflight`
- `fix: prevent ignored file indexing`
- `refactor: isolate path normalization`

## Safety Rules

- Do not commit private planning folders such as `do-not-commit-docs/`.
- Do not store raw secrets in docs, fixtures, proofs, artifacts, logs, or tests.
- Do not make compression authoritative.
- Do not bypass the Trust Kernel.
- Do not add undocumented behavior.
