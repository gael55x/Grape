# Architecture Decisions

This folder contains Architecture Decision Records for V1.

## Index

| ADR | Status | Decision |
|---|---|---|
| `adr-0001-documentation-architecture.md` | Accepted | Create the V1 documentation architecture before production code. |
| `adr-0002-canonical-spec-and-implementation-goals.md` | Accepted | Publish `docs/v1/SPEC.md` and name implementation goals around the work being done. |
| `adr-0003-documentation-structure.md` | Accepted | Keep `SPEC.md` at the V1 root and group supporting docs by purpose. |
| `adr-0004-node-225-sqlite-runtime.md` | Accepted | Require Node 22.5+ and use built-in `node:sqlite` for the initial storage runtime. |
| `adr-0005-compiler-module-ownership.md` | Accepted | Split compiler internals into artifact, pack, repository, section, and policy ownership folders while keeping `src/core/compiler/index.ts` as the public boundary. |
| `adr-0006-benchmark-harness-ownership.md` | Accepted | Own scripted fixture benchmark orchestration under `src/app/benchmark/` while keeping `grape bench` a thin CLI adapter. |
| `adr-0007-git-snapshot-file-manifest-ownership.md` | Accepted | Split Git snapshot orchestration from file manifest hashing and scanner rejection policy. |
| `adr-0008-agent-artifact-annotations.md` | Accepted | Defer agent-authored artifact annotations from V1 rendered artifacts and keep MCP writes non-authoritative evidence only. |
| `adr-0009-lexical-search-runtime-portability.md` | Accepted | Use portable table-backed lexical search instead of requiring SQLite FTS5 extension support. |
| `adr-0010-context-transport-protocol.md` | Accepted | Anchor V1 on session-safe ContextPack transport; defer full memory-platform scope. |
| `adr-0011-language-provider-capabilities.md` | Accepted | Keep broad language support capability-based with safe fallback and monorepo boundaries, without turning V1 into a universal parser. |

## Naming

Use:

```text
adr-0001-title.md
adr-0002-title.md
```

## Required Sections

- Status
- Context
- Decision
- Consequences
- Alternatives
- Supersedes
- Related Spec Sections

## Agent Rule

Agents must check existing ADRs before changing architecture, state transitions, trust boundaries, storage patterns, MCP/CLI contracts, or benchmark policy.

Do not silently contradict an accepted ADR. If an ADR is superseded, create a new ADR and update this index.
