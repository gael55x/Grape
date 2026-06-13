# Agent Operating Rules

These rules apply to AI coding agents working on Grape.

## Before Editing

Read these files first:

1. `docs/v1/README.md`
2. `docs/v1/SPEC.md`
3. `docs/v1/architecture/invariants.md`
4. `docs/v1/architecture/state-machine.md`
5. `docs/v1/planning/implementation-roadmap.md`
6. The specific domain doc for the module you will edit

If the needed behavior is not documented, update the docs before or with the implementation.

Do not implement from placeholders. If a supporting doc says what it should contain but does not define the contract, read `docs/v1/SPEC.md` and harden the supporting doc first.

Before adding code to an existing large file, read `docs/v1/architecture/overview.md#code-modularity-standards`. If the file is past the split checkpoint, split by ownership before adding another responsibility.

The current in-memory smoke harness is not a substitute for typechecking or behavioral tests. After the In-Memory Context Loop, do not add broad feature code until Project Skeleton And Tooling wires real TypeScript and test gates.

## Documentation Traversal

Use `docs/README.md` for the top-level map and `docs/v1/README.md` for V1 work.

For V1 implementation, start with `docs/v1/SPEC.md`, then read only the folder that owns the change:

- `docs/v1/architecture/` for system shape, state machine, and invariants.
- `docs/v1/core/` for trust, compression, storage, and security.
- `docs/v1/contracts/` for context artifact and context diff schemas.
- `docs/v1/interfaces/` for MCP and CLI contracts.
- `docs/v1/quality/` for tests and benchmarks.
- `docs/v1/planning/` for roadmap, logs, and changelogs.
- `docs/v1/decisions/` for accepted ADRs.
- `docs/v1/examples/` and `docs/v1/fixtures/` for serialized examples and fixture expectations.
- `docs/v1/legacy/alpha/` for historical alpha-era documentation only. Do not treat legacy docs as current implementation input.

Do not add new V1 topic files directly under `docs/v1/` unless they are canonical anchors like `README.md` or `SPEC.md`.

## Documentation Privacy Hygiene

Committed documentation must not include personal local paths, usernames, home directories, private workspace names, local machine cache paths, API keys, tokens, or other machine-specific identifiers. Use neutral placeholders such as `<repo-root>`, `<external-workspace>`, `<temporary-cache>`, or repo-relative paths instead.

Before finishing any documentation edit, scan the changed docs for accidental local identifiers. At minimum, check for home-directory paths, private workspace names, absolute temp/cache paths, and secret-looking values. If command history is worth documenting, rewrite it into reproducible, environment-neutral commands before committing it.

Lesson learned: benchmark notes and trial logs can be useful evidence, but raw local command transcripts often contain personal paths. Preserve the evidence, not the machine-specific details.

## Documentation Style And Release Claims

Future documentation changes must:

- use plain language and short sentences
- avoid hype, vague claims, and zombie nouns when they hide the subject or verb
- avoid unsupported benchmark claims, production-readiness claims, and broad major version readiness claims unless proven
- keep technical terms only when they are accurate (for example: compiler, artifact, context pack, session ledger, claim, proof, retrieval, MCP, CLI, SQLite)
- avoid em dashes, arrow symbols, not equal signs, and emojis
- use plus signs and tildes only when technically required
- verify docs against code before changing release-facing claims
- update stale docs when changing CLI, MCP, package, benchmark, compiler, retrieval, session, ledger, restore, invalidation, claim, proof, or artifact behavior

Zombie noun example:

Bad: `The implementation of retrieval optimization enables better utilization of context.`

Better: `Grape ranks retrieved context before it sends a context pack.`

Benchmark claim policy:

- Docs may say Grape includes benchmark fixtures and scripts for local comparison.
- Docs may not claim proven token reduction percentages, external tool superiority, benchmark-proven savings, or production readiness unless committed benchmark artifacts prove the claim and the docs name fixture, command, date, and limits.
- Label local uncommitted JSON as local fixture results, not official release benchmarks.

Before finishing documentation edits, scan changed docs for banned style and accidental local identifiers.

## Commit Message Hygiene

All agent-created commits must use Conventional Commits format:

```text
<type>(optional-scope): <description>
```

Use the smallest accurate type, such as `docs`, `fix`, `feat`, `test`, `refactor`, `chore`, `build`, or `ci`. If the user asks to commit or push without giving a message, choose a concise Conventional Commit message that describes the actual staged change.

Lesson learned: even documentation-only follow-up commits should follow the repository's commit convention. Do not use ad hoc prose commit messages.

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
| Add a source type | `SPEC.md`, `core/trust-model.md`, `core/security.md` | `core/evidence`, `core/security`, storage repos | `core/trust-model.md`, `core/storage.md`, `quality/testing.md` | source classification, privacy, trust rejection | treating source trust as truth |
| Add a proof type | `core/trust-model.md`, `architecture/invariants.md` | `core/proofs`, `core/trust` | `core/trust-model.md`, `core/security.md` | proof hash/support tests | allowing summaries or agent text as proof |
| Add a claim type | `core/trust-model.md`, `architecture/state-machine.md` | `core/claims`, `core/trust`, `core/scope` | `core/trust-model.md`, `core/storage.md` | promotion, stale, contradiction tests | skipping scope resolution |
| Add an artifact section | `contracts/context-artifact.md`, `core/security.md` | `core/compiler`, `core/security` | `contracts/context-artifact.md`, `examples/` | golden JSON/Markdown, secret scan | missing dependency refs |
| Add a task policy | `contracts/context-artifact.md`, `architecture/invariants.md` | `core/compiler`, `core/retrieval` | `contracts/context-artifact.md`, `quality/testing.md` | policy golden tests | bypassing current-valid filtering |
| Add a risk overlay | `SPEC.md`, `core/compression.md` | `core/compiler`, `core/compression` | `contracts/context-artifact.md`, `core/compression.md`, `architecture/invariants.md` | exact-span and compression-forbidden tests | allowing summary-only high-risk context |
| Add compression artifact type | `core/compression.md`, `contracts/context-diff.md` | `core/compression`, `core/compiler`, `core/diff` | `core/compression.md`, `core/storage.md` | input hash and invalidation tests | making compression authoritative |
| Add MCP tool | `interfaces/mcp-tools.md`, `core/security.md` | `src/mcp`, `src/app` | `interfaces/mcp-tools.md`, `examples/` | contract and safety tests | putting business logic in adapter |
| Add CLI command | `interfaces/cli.md`, `core/security.md` | `src/cli`, `src/app` | `interfaces/cli.md`, `examples/` | snapshot and JSON schema tests | unredacted debug output |
| Add state transition | `architecture/state-machine.md`, `architecture/invariants.md` | `core/state`, affected domain module | `architecture/state-machine.md`, `quality/testing.md` | transition test | hidden side effects |
| Add SQLite migration | `core/storage.md` | `core/storage` | `core/storage.md`, `planning/spec-changelog.md` | migration up/from-previous tests | direct SQL outside repos |
| Add benchmark | `quality/benchmarks.md`, `fixtures/README.md` | benchmark harness | `quality/benchmarks.md`, fixture docs | deterministic benchmark test | ad hoc baseline |
| Add fixture repo | `fixtures/README.md`, `quality/testing.md` | `tests/fixtures` | `fixtures/README.md`, tests | fixture metadata validation | unlabeled expected output |

## Uncertainty Protocol

- If the spec is silent, do not infer durable behavior. Add or update docs first.
- If current-valid scope is unknown, return warning/partial context or `unsafe_compile`; do not treat unknown as match.
- If a source may contain secrets, block or redact before indexing or rendering.
- If a module boundary is unclear, update `docs/v1/architecture/overview.md` before adding imports.
- If a test cannot be written because the behavior is unclear, the spec is not ready for that behavior.
- Keep `docs/v1/planning/implementation-log.md` milestone-level. Do not add one log entry per commit.
- For AI-assisted implementation log entries, use `Author/agent: <human contributor> / <agent name>`.

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
- Never commit personal local paths, usernames, home directories, private workspace names, API keys, tokens, or machine-specific cache paths into public docs, examples, fixtures, logs, or benchmark reports.
- Never create an agent-authored commit with a non-Conventional Commit message.
- Never allow MCP write tools to promote durable truth directly.
- Never silently read ignored or private files.
- Never store raw secrets in proofs, artifacts, logs, fixtures, or docs.
- Never commit `do-not-commit-docs/`.
- Never implement behavior that contradicts `docs/v1/SPEC.md`.
- Never use placeholder docs as permission to invent behavior.
- Never add generic utility modules that hide domain ownership.
- Never create or expand godfiles when a focused module split would keep ownership clear.
- Never return context generated from stale dependency manifests.

## Required Closeout

Before finishing work, report:

- docs updated
- tests added or why not applicable
- commands run
- documentation privacy scan results when docs changed
- known gaps or risks
