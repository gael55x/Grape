# Grape V1 Alpha Era Documentation

This folder holds completed alpha-milestone documentation. It is background and historical evidence only. It is not an active implementation contract.

For current work, start at:

- [V1 documentation](../../README.md)
- [Implementation contract](../../SPEC.md)
- [Product roadmap](../../../../ROADMAP.md)
- [Beta readiness](../../planning/beta-readiness.md)
- [Beta trial checklist](../../planning/beta-trial-checklist.md)

## What alpha meant

Alpha proved the context transport protocol on real repos:

- global install and `grape init --connect`
- CLI and MCP `grape_get_context`
- session-scoped `NEW`, `PINNED`, `OMIT_UNCHANGED`, `RESTORE_AVAILABLE`, `INVALIDATE_PREVIOUS`
- branch, source, dependency, and explicit reset invalidation
- packaged install smoke, benchmark fixtures, and cross-platform CI hardening

Published alpha releases: `0.1.0-alpha.1` through `0.1.0-alpha.3` (npm `latest`/`alpha` before the beta publish).

Beta (`1.0.0-beta.0`, npm `beta` dist-tag) is the workflow-ready transport slice built on that proof.

## Archived documents

| Document | Why it lives here |
|---|---|
| [in-memory-context-loop.md](in-memory-context-loop.md) | Completed first implementation goal: in-memory compiler loop before SQLite, CLI, or MCP. |
| [transport-wedge-cleanup.md](transport-wedge-cleanup.md) | Alpha.3 product-wedge alignment summary and completed cleanup items. |
| [benchmark-readiness-report.md](benchmark-readiness-report.md) | Pre-beta benchmark readiness evidence from the alpha.3 candidate era. Superseded by `1.0.0-beta.0` publish. |

## Related active docs that reference alpha work

- [Implementation roadmap](../../planning/implementation-roadmap.md) — ordered historical goals; see beta section for current target.
- [Implementation log](../../planning/implementation-log.md) — full chronicle from Documentation Foundation through beta hardening.
- [Beta readiness](../../planning/beta-readiness.md) — beta checklist and verification commands.
- [V1 changelog](../../planning/changelog.md) and [root CHANGELOG](../../../../CHANGELOG.md) — release history.

## Do not implement from here

- Do not treat alpha planning tickets (`memory-*`) as open work.
- Do not treat alpha.3 hardening ledger rows as beta scope expansion.
- If behavior here conflicts with `docs/v1/SPEC.md`, `SPEC.md` wins.
