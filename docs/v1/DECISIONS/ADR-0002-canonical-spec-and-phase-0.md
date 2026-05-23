# ADR-0002: Canonical Spec And Phase 0 Split

## Status

Accepted

## Context

The authoritative V1 framework spec was originally maintained under `do-not-commit-docs/`, which is intentionally ignored. That created an implementation risk: future humans and AI agents could build from thin supporting docs while the actual contract stayed outside the committed documentation tree.

The canonical spec also uses "Phase 0" for the alpha vertical slice. The public implementation-preparation docs need a prior documentation-hardening phase so the state machine, invariants, storage contract, MCP contract, test standards, and benchmark standards exist before production code begins.

## Decision

- Publish the canonical V1 implementation contract at `docs/v1/SPEC.md`.
- Treat `docs/v1/SPEC.md` as the committed source of truth for V1 implementation.
- Treat domain docs in `docs/v1/` as implementation guides derived from `SPEC.md`.
- Split Phase 0 into:
  - `Phase 0A`: documentation and standards foundation.
  - `Phase 0B`: alpha vertical slice from the canonical spec.
- Keep `do-not-commit-docs/` ignored and never commit it.

## Consequences

- Future implementation work must read `docs/v1/SPEC.md` before changing code.
- Supporting docs must not contradict `SPEC.md`; disagreements block implementation until reconciled.
- Phase 0A can be completed without starting product code.
- Phase 0B remains the first implementation slice.

## Alternatives

- Keep using ignored docs as the implementation contract. Rejected because committed docs would not be self-contained.
- Rename the alpha vertical slice instead of splitting Phase 0. Rejected because the split preserves the original spec while making the prerequisite guardrail phase explicit.

## Related Spec Sections

- Canonical V1 implementation contract.
- Implementation-readiness checklist.
- Build order.
