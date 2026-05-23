# ADR-0001: Documentation Architecture

## Status

Accepted

## Context

Grape V1 will be implemented over many phases by humans and AI agents. The project needs a public documentation structure before production code begins so implementation decisions stay coherent and traceable.

## Decision

Create a V1 documentation tree under `docs/v1/` with domain-specific documents for architecture, state machine, trust model, context artifacts, compression, context diffing, MCP tools, CLI, storage, testing, benchmarks, security, invariants, implementation phases, decisions, examples, and fixtures.

## Consequences

- Implementation work must update the relevant docs and tests.
- Future-version ideas stay out of V1 implementation docs.
- Historical material belongs in `docs/archive/`.
- AI agents have a documented operating framework before editing code.

## Alternatives

- Keep one large spec only. Rejected because it is hard for agents and maintainers to navigate during implementation.
- Let docs emerge after code. Rejected because trust and state-machine drift would be likely.

## Supersedes

None.

## Related Spec Sections

- V1 product definition
- high-level architecture
- implementation-readiness checklist
- build order
