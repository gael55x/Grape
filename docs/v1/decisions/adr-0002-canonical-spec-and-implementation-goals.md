# ADR-0002: Canonical Spec And Implementation Goals

## Status

Accepted

## Context

The authoritative V1 framework spec was originally maintained under `do-not-commit-docs/`, which is intentionally ignored. That created an implementation risk: future humans and AI agents could build from thin supporting docs while the actual contract stayed outside the committed documentation tree.

The canonical spec starts with an alpha vertical slice. The public implementation-preparation docs need a prior documentation foundation so the state machine, invariants, storage contract, MCP contract, test standards, and benchmark standards exist before production code begins.

## Decision

- Publish the canonical V1 implementation contract at `docs/v1/SPEC.md`.
- Treat `docs/v1/SPEC.md` as the committed source of truth for V1 implementation.
- Treat domain docs in `docs/v1/` as implementation guides derived from `SPEC.md`.
- Use goal names in implementation docs:
  - Documentation Foundation: standards, contracts, and guardrails before code.
  - In-Memory Context Loop: the first implementation slice, limited to shape guards and one fixture.
  - Alpha Product Slice: the later persisted CLI/MCP/session-ledger slice from the canonical spec.
- Keep `do-not-commit-docs/` ignored and never commit it.

## Consequences

- Future implementation work must read `docs/v1/SPEC.md` before changing code.
- Supporting docs must not contradict `SPEC.md`; disagreements block implementation until reconciled.
- Documentation Foundation can be completed without starting product code.
- In-Memory Context Loop remains the first implementation slice.
- Alpha Product Slice remains the first product-shaped slice.

## Alternatives

- Keep using ignored docs as the implementation contract. Rejected because committed docs would not be self-contained.
- Use numeric planning labels in public docs. Rejected because goal names are clearer for long-running human and AI-assisted implementation.

## Related Spec Sections

- Canonical V1 implementation contract.
- Implementation-readiness checklist.
- Build order.
