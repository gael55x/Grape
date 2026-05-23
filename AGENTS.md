# Agent Operating Rules

These rules apply to AI coding agents working on Grape.

## Before Editing

Read these files first:

1. `docs/v1/README.md`
2. `docs/v1/SPEC.md`
3. `docs/v1/INVARIANTS.md`
4. `docs/v1/STATE_MACHINE.md`
5. `docs/v1/IMPLEMENTATION_PHASES.md`
6. The specific domain doc for the module you will edit

If the needed behavior is not documented, update the docs before or with the implementation.

Do not implement from placeholders. If a supporting doc says what it should contain but does not define the contract, read `docs/v1/SPEC.md` and harden the supporting doc first.

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

## Reusable Procedures

Use these procedures before editing code or docs for the listed behavior.

| Change | Read first | Source areas | Docs to update | Required tests | Common mistakes |
|---|---|---|---|---|---|
| Add a source type | `SPEC.md`, `TRUST_MODEL.md`, `SECURITY.md` | `core/evidence`, `core/security`, storage repos | `TRUST_MODEL.md`, `STORAGE.md`, `TESTING.md` | source classification, privacy, trust rejection | treating source trust as truth |
| Add a proof type | `TRUST_MODEL.md`, `INVARIANTS.md` | `core/proofs`, `core/trust` | `TRUST_MODEL.md`, `SECURITY.md` | proof hash/support tests | allowing summaries or agent text as proof |
| Add a claim type | `TRUST_MODEL.md`, `STATE_MACHINE.md` | `core/claims`, `core/trust`, `core/scope` | `TRUST_MODEL.md`, `STORAGE.md` | promotion, stale, contradiction tests | skipping scope resolution |
| Add an artifact section | `CONTEXT_ARTIFACT.md`, `SECURITY.md` | `core/compiler`, `core/security` | `CONTEXT_ARTIFACT.md`, `EXAMPLES/` | golden JSON/Markdown, secret scan | missing dependency refs |
| Add a task policy | `CONTEXT_ARTIFACT.md`, `INVARIANTS.md` | `core/compiler`, `core/retrieval` | `CONTEXT_ARTIFACT.md`, `TESTING.md` | policy golden tests | bypassing current-valid filtering |
| Add a risk overlay | `SPEC.md`, `COMPRESSION.md` | `core/compiler`, `core/compression` | `CONTEXT_ARTIFACT.md`, `COMPRESSION.md`, `INVARIANTS.md` | exact-span and compression-forbidden tests | allowing summary-only high-risk context |
| Add compression artifact type | `COMPRESSION.md`, `CONTEXT_DIFF.md` | `core/compression`, `core/compiler`, `core/diff` | `COMPRESSION.md`, `STORAGE.md` | input hash and invalidation tests | making compression authoritative |
| Add MCP tool | `MCP_TOOLS.md`, `SECURITY.md` | `src/mcp`, `src/app` | `MCP_TOOLS.md`, `EXAMPLES/` | contract and safety tests | putting business logic in adapter |
| Add CLI command | `CLI.md`, `SECURITY.md` | `src/cli`, `src/app` | `CLI.md`, `EXAMPLES/` | snapshot and JSON schema tests | unredacted debug output |
| Add state transition | `STATE_MACHINE.md`, `INVARIANTS.md` | `core/state`, affected domain module | `STATE_MACHINE.md`, `TESTING.md` | transition test | hidden side effects |
| Add SQLite migration | `STORAGE.md` | `core/storage` | `STORAGE.md`, `SPEC_CHANGELOG.md` | migration up/from-previous tests | direct SQL outside repos |
| Add benchmark | `BENCHMARKS.md`, `FIXTURES/README.md` | benchmark harness | `BENCHMARKS.md`, fixture docs | deterministic benchmark test | ad hoc baseline |
| Add fixture repo | `FIXTURES/README.md`, `TESTING.md` | `tests/fixtures` | `FIXTURES/README.md`, tests | fixture metadata validation | unlabeled expected output |

## Uncertainty Protocol

- If the spec is silent, do not infer durable behavior. Add or update docs first.
- If current-valid scope is unknown, return warning/partial context or `unsafe_compile`; do not treat unknown as match.
- If a source may contain secrets, block or redact before indexing or rendering.
- If a module boundary is unclear, update `ARCHITECTURE.md` before adding imports.
- If a test cannot be written because the behavior is unclear, the spec is not ready for that behavior.

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
- Never implement behavior that contradicts `docs/v1/SPEC.md`.
- Never use placeholder docs as permission to invent behavior.
- Never add generic utility modules that hide domain ownership.
- Never return context generated from stale dependency manifests.

## Required Closeout

Before finishing work, report:

- docs updated
- tests added or why not applicable
- commands run
- known gaps or risks
