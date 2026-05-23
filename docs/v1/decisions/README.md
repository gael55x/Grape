# Architecture Decisions

This folder contains Architecture Decision Records for V1.

## Index

| ADR | Status | Decision |
|---|---|---|
| `adr-0001-documentation-architecture.md` | Accepted | Create the V1 documentation architecture before production code. |
| `adr-0002-canonical-spec-and-phase-0.md` | Accepted | Publish `docs/v1/SPEC.md` and split Phase 0 into documentation hardening and alpha vertical slice. |
| `adr-0003-documentation-structure.md` | Accepted | Keep `SPEC.md` at the V1 root and group supporting docs by purpose. |

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
