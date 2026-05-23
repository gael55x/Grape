# Grape

Grape is a local-first incremental context compiler for AI coding agents.

V1 is focused on one implementation contract: compile safe, current, task-specific context artifacts from verified repo state, branch state, project rules, prior decisions, tests, and previous agent context; track what was already sent per agent session; use compression as cache, not truth; invalidate stale context; resend pinned safety-critical context; and return only safe context deltas through MCP or CLI.

This repository is in implementation-preparation mode. The project is not ready for production feature work until the V1 documentation, state machine, invariants, tests, benchmark baselines, and agent operating rules are in place.

## Current Documentation

- [V1 Documentation Index](docs/v1/README.md)
- [Architecture](docs/v1/ARCHITECTURE.md)
- [State Machine](docs/v1/STATE_MACHINE.md)
- [Invariants](docs/v1/INVARIANTS.md)
- [Implementation Phases](docs/v1/IMPLEMENTATION_PHASES.md)
- [Agent Operating Rules](AGENTS.md)

## Canonical V1 Contract

The canonical V1 implementation contract is maintained in the project documentation under `docs/v1/`. Historical or private planning material must not be treated as source code or committed accidentally.

## Implementation Principle

Grape should be boring, explicit, typed, and inspectable. Trust and correctness invariants come before token savings.
