# Grape V1 Documentation

This folder is the implementation-facing documentation set for Grape V1.

Grape V1 is a local-first incremental context compiler for AI coding agents. It compiles safe, current, task-specific context artifacts; tracks what was already sent per session; uses compression as cache, not truth; invalidates stale context; resends pinned safety-critical context; and returns safe deltas through MCP or CLI.

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
    compression.md
    storage.md
    security.md
  contracts/
    context-artifact.md
    context-diff.md
  interfaces/
    mcp-tools.md
    cli.md
  quality/
    testing.md
    benchmarks.md
  planning/
    implementation-phases.md
    implementation-log.md
    changelog.md
    spec-changelog.md
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
| Core | `core/compression.md` | Derived compression cache, input hashes, invalidation, high-risk restrictions. | Compression behavior changes. | Summaries remain non-authoritative. |
| Core | `core/storage.md` | SQLite schema, repositories, migrations, WAL/concurrency, path rules. | Schema or persistence changes. | No direct SQLite writes outside repositories. |
| Core | `core/security.md` | Local-first privacy, ignored files, redaction, secret handling. | Security-sensitive behavior changes. | No raw secrets or silent ignored-file reads. |
| Contracts | `contracts/context-artifact.md` | Context artifact schema, sections, dependency manifest, output rules. | Artifact schema or sections change. | Artifact changes include manifest and tests. |
| Contracts | `contracts/context-diff.md` | Session-scoped diff protocol, sent ledger, omitted restore, invalidation. | Diff/session behavior changes. | The change remains session-scoped. |
| Interfaces | `interfaces/mcp-tools.md` | MCP tool contracts and safety boundaries. | MCP tools change. | Write tools cannot promote durable truth. |
| Interfaces | `interfaces/cli.md` | CLI commands, outputs, exit codes, inspection workflows. | CLI behavior changes. | CLI is adapter-only. |
| Quality | `quality/testing.md` | Test categories, named tests, fixture mapping. | Test strategy or required tests change. | Required tests exist for touched invariant/transition. |
| Quality | `quality/benchmarks.md` | Benchmark metrics, baselines, thresholds, token-saving proof. | Benchmarks or token-saving claims change. | Baselines are scripted. |
| Planning | `planning/implementation-phases.md` | Phase order, deliverables, exit criteria. | Scope or build order changes. | Work belongs to the current phase. |
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
- `docs/archive/` is historical only.
- Private planning folders are not implementation input after the canonical material has been copied into this docs tree through an explicit docs change.
- `do-not-commit-docs/` must never be committed.

## Required Agent Workflow

1. Read `AGENTS.md`.
2. Read this index.
3. Read `SPEC.md`.
4. Read `architecture/invariants.md`.
5. Read the specific domain doc for the code being changed.
6. Update docs, tests, and examples in the same change when behavior changes.
