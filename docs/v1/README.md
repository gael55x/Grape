# Grape V1 Documentation

This folder is the implementation-facing documentation set for Grape V1.

Grape V1 is a **local-first context compiler and context transport layer** for AI coding agents on git repositories.

It **compiles** safe, current, task-specific `ContextArtifact` objects from repo state (snapshot, rules, proof-backed excerpts, lightweight indexing). It **diffs** each compile against what the current agent session already received. It **ships** a structured `ContextPack` (`NEW`, `CHANGED`, `PINNED`, `OMIT_UNCHANGED`, `INVALIDATE_PREVIOUS`, `RESTORE_AVAILABLE`) through MCP or CLI.

Compression is cache, not truth. Proofs gate durable claims. Git branch/worktree and dependency hashes drive invalidation. See [`decisions/adr-0010-context-transport-protocol.md`](decisions/adr-0010-context-transport-protocol.md) and the root [`ROADMAP.md`](../../ROADMAP.md).

**Published npm today:** `grape-context@1.0.0-beta.0` on the `beta` dist-tag. npm `latest` and `alpha` still point at `0.1.0-alpha.3`. Install and session setup: root [`README.md`](../../README.md) and [`interfaces/agent-sessions.md`](interfaces/agent-sessions.md). Alpha-era docs: [`legacy/alpha/README.md`](legacy/alpha/README.md).

## Structure

```text
docs/v1/
  README.md
  SPEC.md
  architecture/
    overview.md
    state-machine.md
    invariants.md
  core/
    trust-model.md
    language-indexing.md
    retrieval.md
    compression.md
    storage.md
    security.md
  contracts/
    transport-stability.md
    context-artifact.md
    context-diff.md
  interfaces/
    agent-sessions.md
    mcp-tools.md
    cli.md
  quality/
    testing.md
    benchmarks.md
  planning/
    beta-readiness.md
    beta-trial-checklist.md
    implementation-roadmap.md
    implementation-status.md
    implementation-log.md
    changelog.md
    spec-changelog.md
  legacy/
    alpha/
  decisions/
  examples/
  fixtures/
```

## Documentation Map

| Area | File or folder | Purpose | Update when | Agent check before editing |
|---|---|---|---|---|
| Canonical contract | `SPEC.md` | Committed V1 implementation contract. | Any V1 contract changes. | Do not implement behavior that contradicts this file. |
| Architecture | `architecture/overview.md` | Layers, source tree, module ownership, dependency direction. | Modules or dependency rules change. | The target module owns the behavior. |
| Architecture | `architecture/state-machine.md` | Explicit V1 states, transitions, validations, persistence, tests. | Any state or transition changes. | No hidden transition is introduced. |
| Architecture | `architecture/invariants.md` | Non-negotiable correctness and safety rules. | Invariants or enforcement locations change. | The touched invariant has tests. |
| Core | `core/trust-model.md` | Evidence, proofs, claims, Trust Kernel, scope, current-valid gates. | Trust behavior changes. | The change cannot bypass proof validation. |
| Core | `core/language-indexing.md` | Language-provider capabilities, polyglot fallback behavior, monorepo indexing boundaries, and known language assumptions. | Language extraction, provider dispatch, monorepo retrieval, or language-support claims change. | Provider facts remain orientation and unsupported languages report blind spots. |
| Core | `core/retrieval.md` | Lightweight task source retrieval, selection rules, warnings, and beta boundary. | Retrieval behavior changes. | Retrieval stays current-valid and reports blind spots. |
| Core | `core/compression.md` | Derived compression cache, input hashes, invalidation, high-risk restrictions. | Compression behavior changes. | Summaries remain non-authoritative. |
| Core | `core/storage.md` | SQLite schema, repositories, migrations, WAL/concurrency, path rules. | Schema or persistence changes. | No direct SQLite writes outside repositories. |
| Core | `core/security.md` | Local-first privacy, ignored files, redaction, secret handling. | Security-sensitive behavior changes. | No raw secrets or silent ignored-file reads. |
| Contracts | `contracts/transport-stability.md` | Beta transport/schema stability boundary, warning taxonomy, and compatibility rules. | MCP request/response fields are added, reclassified, or removed. | Stable vs experimental fields remain clear. |
| Contracts | `contracts/context-artifact.md` | Context artifact schema, sections, dependency manifest, output rules. | Artifact schema or sections change. | Artifact changes include manifest and tests. |
| Contracts | `contracts/context-diff.md` | Session-scoped diff protocol, sent ledger, omitted restore, invalidation. | Diff/session behavior changes. | The change remains session-scoped. |
| Interfaces | `interfaces/agent-sessions.md` | Agent-facing session/task identity contract, recovery paths, and beta install notes. | Session identity guidance, setup handoff, or mismatch recovery changes. | Continued turns keep stable task/session identity. |
| Interfaces | `interfaces/mcp-tools.md` | MCP tool contracts and safety boundaries. | MCP tools change. | Write tools cannot promote durable truth. |
| Interfaces | `interfaces/cli.md` | CLI commands, outputs, exit codes, inspection workflows. | CLI behavior changes. | CLI is adapter-only. |
| Quality | `quality/testing.md` | Test categories, named tests, fixture mapping. | Test strategy or required tests change. | Required tests exist for touched invariant/transition. |
| Quality | `quality/benchmarks.md` | Benchmark metrics, baselines, thresholds, and transport harness gates. | Benchmarks or transport benchmark claims change. | Baselines are scripted. Local fixture numbers are not official release benchmarks. |
| Planning | `planning/implementation-roadmap.md` | Goal order, deliverables, exit criteria. | Scope or build order changes. | Work belongs to the current goal. |
| Planning | `planning/implementation-status.md` | Acceptance matrix for the V1 core pipeline. | A core-pipeline area changes status. | Status reflects implementation, tests, docs, and known limitations honestly. |
| Planning | `planning/beta-readiness.md` | Pre-beta review checklist, setup verification commands, and benchmark workspace alignment notes. | Alpha/beta readiness criteria, human-review checklist, or external benchmark alignment changes. | Checklist does not expand V1 scope or change benchmark methodology. |
| Planning | `planning/beta-trial-checklist.md` | Real client trial steps, pass/fail criteria, and beta exclusions. | Trial requirements, supported clients, or beta scope changes. | Trials prove transport reliability and do not promise unfinished memory features. |
| Planning | `planning/implementation-log.md` | Chronological implementation-preparation and implementation log. | Substantial work is completed. | Read recent entries before continuing. |
| Planning | `planning/changelog.md` | V1 implementation-facing changelog. | V1 behavior or docs change. | Root changelog is updated when user-facing behavior changes. |
| Planning | `planning/spec-changelog.md` | Spec-contract change log. | V1 contract changes. | Update before implementing changed behavior. |
| Decisions | `decisions/` | Architecture Decision Records. | A lasting design decision is made. | Existing ADRs are not contradicted silently. |
| Examples | `examples/` | Example artifacts, MCP responses, CLI outputs. | Serialized contracts change. | Examples match schemas and tests. |
| Fixtures | `fixtures/` | Fixture documentation and benchmark expectations. | Fixtures are added or changed. | Fixture expectations are deterministic. |

## Source-Of-Truth Rules

- `docs/v1/SPEC.md` is the canonical committed V1 implementation contract.
- Domain docs in this folder are implementation guides derived from `SPEC.md`.
- If a domain doc and `SPEC.md` disagree, stop and update the docs before coding.
- `docs/v2/` is future planning only.
- `docs/v1/legacy/alpha/` is historical alpha documentation only.
- `docs/archive/` redirects to the legacy index.
- Private planning folders are not implementation input after the canonical material has been copied into this docs tree through an explicit docs change.
- `do-not-commit-docs/` must never be committed.

## Required Agent Workflow

1. Read `AGENTS.md`.
2. Read this index.
3. Read `SPEC.md`.
4. Read `architecture/invariants.md`.
5. Read the specific domain doc for the code being changed.
6. Update docs, tests, and examples in the same change when behavior changes.
