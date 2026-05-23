# Grape V1 Documentation

This folder is the implementation-facing documentation set for Grape V1.

Grape V1 is a local-first incremental context compiler for AI coding agents. It compiles safe, current, task-specific context artifacts; tracks what was already sent per session; uses compression as cache, not truth; invalidates stale context; resends pinned safety-critical context; and returns safe deltas through MCP or CLI.

## Documentation Map

| File or folder | Purpose | Required contents | Primary readers | Update when | Agent check before editing |
|---|---|---|---|---|---|
| `README.md` | V1 documentation index and operating map. | Links, doc ownership, source-of-truth rules. | Everyone. | Any V1 doc is added, renamed, or repurposed. | Confirm the relevant domain doc exists. |
| `ARCHITECTURE.md` | System layers, module boundaries, dependency direction. | Layer map, module map, dependency rules, Mermaid diagram. | Engineers and agents. | A module, layer, or dependency rule changes. | Check whether the target module owns the behavior. |
| `STATE_MACHINE.md` | Grape V1 as explicit states and transitions. | State list, transition rules, forbidden transitions, tests. | Core implementers. | Any state or transition changes. | No hidden state transition is being introduced. |
| `TRUST_MODEL.md` | Evidence, proofs, claims, Trust Kernel, layer isolation. | Promotion rules, proof rules, source trust, failure behavior. | Trust, evidence, retrieval, compiler implementers. | Trust behavior changes. | The change cannot bypass proof validation. |
| `CONTEXT_ARTIFACT.md` | Context artifact contract. | Schema, sections, dependency manifest, JSON/Markdown output. | Compiler, MCP, CLI implementers. | Artifact schema or section changes. | Artifact changes include manifest and tests. |
| `COMPRESSION.md` | Compression cache rules. | Cache types, input hashes, invalidation, high-risk restrictions. | Compression and compiler implementers. | Compression behavior changes. | Summaries remain non-authoritative. |
| `CONTEXT_DIFF.md` | Session-scoped diff protocol. | Diff states, sent items, omitted items, restore behavior. | Diff, session, MCP implementers. | Diff or session behavior changes. | The change remains session-scoped. |
| `MCP_TOOLS.md` | MCP tool contracts and safety boundaries. | Tool schemas, read/write rules, examples. | MCP implementers and agent integrators. | MCP tools change. | Write tools cannot promote durable truth. |
| `CLI.md` | CLI command contracts. | Commands, outputs, exit codes, debug workflows. | CLI implementers and users. | CLI behavior changes. | CLI is adapter-only, not business logic. |
| `STORAGE.md` | SQLite schema, repositories, migrations, concurrency. | Table ownership, migration rules, storage APIs. | Storage implementers. | Schema or persistence changes. | No direct SQLite writes outside repositories. |
| `TESTING.md` | Test standards. | Unit, integration, fixture, golden, contract, migration tests. | All implementers. | Test strategy changes. | Required tests exist for the touched invariant. |
| `BENCHMARKS.md` | Benchmark standards and thresholds. | Fixtures, baselines, metrics, failure thresholds. | Benchmark and release maintainers. | Benchmarks or claims change. | Baselines are scripted, not ad hoc. |
| `SECURITY.md` | Privacy, redaction, ignored files, local-first behavior. | Secret handling, ignore policy, artifact scan rules. | Security, storage, compiler implementers. | Security-sensitive behavior changes. | No raw secrets or silent ignored-file reads. |
| `INVARIANTS.md` | Non-negotiable correctness rules. | Invariant, reason, enforcement, required tests. | Everyone. | Invariants are added or changed. | No invariant is weakened casually. |
| `IMPLEMENTATION_PHASES.md` | Ordered implementation roadmap. | Phase goals, deliverables, non-goals, exit criteria. | Maintainers and agents. | Scope or build order changes. | Work belongs to the current phase. |
| `CHANGELOG.md` | V1 implementation-facing changelog. | Phase-level docs/code/test changes. | Maintainers. | V1 implementation behavior changes. | User-facing changes also update root changelog. |
| `SPEC_CHANGELOG.md` | Spec-contract change log. | Date, changed section, reason, impact. | Maintainers and agents. | V1 contract changes. | Update before implementing changed behavior. |
| `IMPLEMENTATION_LOG.md` | Chronological implementation log. | Phase, author/agent, files, tests, risks. | Maintainers and future agents. | Substantial work is completed. | Read recent entries before continuing. |
| `DECISIONS/` | Architecture Decision Records. | ADR index and ADR files. | Maintainers and agents. | A design decision has lasting impact. | Existing ADRs are not contradicted silently. |
| `EXAMPLES/` | Example artifacts, MCP responses, CLI outputs. | Gold examples and explanations. | Users, test authors, agents. | Serialized contracts change. | Examples match tests and docs. |
| `FIXTURES/` | Fixture documentation. | Fixture purpose, expected labels, benchmark baselines. | Test and benchmark authors. | Fixtures are added or changed. | Fixture expectations are deterministic. |

## Source-Of-Truth Rules

- V1 docs in this folder are active implementation guidance.
- `docs/v2/` is future planning only.
- `docs/archive/` is historical only.
- Private planning folders are not implementation input unless copied into this docs tree through an explicit docs change.

## Required Agent Workflow

1. Read `AGENTS.md`.
2. Read this index.
3. Read `INVARIANTS.md`.
4. Read the specific domain doc for the code being changed.
5. Update docs, tests, and examples in the same change when behavior changes.
