# Contributing

Grape is not ready for broad feature work yet. Contributions must first preserve the implementation discipline described in `docs/v1/`.

## Required Reading

Before changing production code, read:

1. `AGENTS.md`
2. `docs/v1/README.md`
3. `docs/v1/SPEC.md`
4. `docs/v1/INVARIANTS.md`
5. `docs/v1/STATE_MACHINE.md`
6. The domain document for the code you intend to touch

## Change Requirements

- Every state transition needs a documented transition and tests.
- Every schema change needs a migration, storage docs, and migration tests.
- Every trust rule needs Trust Model and invariant tests.
- Every context artifact field needs artifact docs and golden tests.
- Every compression behavior needs input-hash and invalidation tests.
- Every MCP or CLI contract change needs docs and contract/snapshot tests.
- Every benchmark claim needs a named fixture and scripted naive baseline.
- Every security behavior needs security docs and redaction/ignored-file tests.
- Every serialized output change needs examples and golden tests.
- Every lasting architecture decision needs an ADR.
- Every V1 contract change needs `docs/v1/SPEC_CHANGELOG.md`.
- Every substantial implementation step needs `docs/v1/IMPLEMENTATION_LOG.md`.

## Domain Gates

| Change | Required docs | Required tests |
|---|---|---|
| State transition | `STATE_MACHINE.md` | transition test |
| Trust/proof/claim rule | `TRUST_MODEL.md`, `INVARIANTS.md` | trust safety test |
| Context artifact field/section | `CONTEXT_ARTIFACT.md`, `EXAMPLES/` | golden artifact test |
| Context diff state/ledger | `CONTEXT_DIFF.md` | diff/session test |
| MCP tool | `MCP_TOOLS.md`, `SECURITY.md` | MCP contract test |
| CLI command | `CLI.md` | CLI snapshot and JSON schema test |
| Storage table/index/migration | `STORAGE.md` | migration and repository test |
| Compression artifact | `COMPRESSION.md` | input hash and invalidation test |
| Benchmark | `BENCHMARKS.md`, `FIXTURES/` | benchmark determinism test |

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
