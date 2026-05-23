# ADR-0003: V1 Documentation Structure

## Status

Accepted

## Context

The first committed V1 docs placed most implementation guides directly under `docs/v1/`. That made the folder hard to scan because canonical spec, architecture, core behavior, interface contracts, quality standards, planning logs, examples, fixtures, and decisions were mixed together.

Future humans and AI agents need to find the right implementation guidance quickly without treating every document as the same kind of authority.

## Decision

Keep `docs/v1/SPEC.md` at the top level as the canonical V1 implementation contract. Move supporting docs into purpose-based folders:

- `architecture/` for system shape, state machine, and invariants.
- `core/` for trust, compression, storage, and security behavior.
- `contracts/` for context artifact and context diff schemas.
- `interfaces/` for MCP and CLI adapter contracts.
- `quality/` for tests and benchmarks.
- `planning/` for phases, changelogs, and implementation log.
- `decisions/`, `examples/`, and `fixtures/` for ADRs, serialized examples, and fixture documentation.

Use lowercase kebab-case filenames for supporting docs. Keep `README.md` and `SPEC.md` uppercase because they are conventional anchors.

## Consequences

- Agents must use `docs/v1/README.md` as the navigation map.
- Supporting docs are easier to keep aligned with ownership boundaries.
- Path references must be updated when docs move.
- Future doc additions must go into the correct purpose-based folder instead of the V1 root.

## Alternatives

- Keep all V1 docs flat. Rejected because it increases navigation cost and drift risk.
- Move `SPEC.md` into a subfolder. Rejected because the canonical implementation contract should remain easy to find.

## Supersedes

None.

## Related Spec Sections

- Implementation-readiness checklist.
- Agent operating rules.
- Documentation quality gates.
