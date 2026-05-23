# Agent Operating Rules

These rules apply to AI coding agents working on Grape.

## Before Editing

Read these files first:

1. `docs/v1/README.md`
2. `docs/v1/INVARIANTS.md`
3. `docs/v1/STATE_MACHINE.md`
4. `docs/v1/IMPLEMENTATION_PHASES.md`
5. The specific domain doc for the module you will edit

If the needed behavior is not documented, update the docs before or with the implementation.

## How To Choose The Right Module

- CLI behavior belongs in `src/cli/`.
- MCP tool transport and schemas belong in `src/mcp/`.
- Workflow orchestration belongs in `src/app/`.
- State transitions belong in `src/core/state/`.
- Evidence ingestion belongs in `src/core/evidence/`.
- Trust promotion belongs in `src/core/trust/`.
- Proof validation belongs in `src/core/proofs/`.
- Scope matching belongs in `src/core/scope/`.
- Current-valid filtering belongs in `src/core/retrieval/`.
- Artifact compilation belongs in `src/core/compiler/`.
- Compression cache behavior belongs in `src/core/compression/`.
- Context diff behavior belongs in `src/core/diff/`.
- Session locks belong in `src/core/sessions/`.
- SQLite access belongs in `src/core/storage/`.

## Never Rules

- Never bypass the Trust Kernel.
- Never use summaries as proof.
- Never promote model-inferred claims to durable memory.
- Never make compression authoritative.
- Never treat current-valid filtering as relevance ranking.
- Never omit pinned safety context.
- Never use one global context lock.
- Never add a state transition without tests.
- Never add a schema field without docs and migration.
- Never introduce platform-specific path assumptions.
- Never allow MCP write tools to promote durable truth directly.
- Never silently read ignored or private files.
- Never store raw secrets in proofs, artifacts, logs, fixtures, or docs.
- Never commit `do-not-commit-docs/`.

## Required Closeout

Before finishing work, report:

- docs updated
- tests added or why not applicable
- commands run
- known gaps or risks
