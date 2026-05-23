# V1 Implementation Phases

## Purpose

Define the order of implementation and prevent feature work from jumping ahead of foundations.

## Required Contents

Each phase must define:

- goal
- deliverables
- non-goals
- required docs
- required tests
- required benchmarks when applicable
- exit criteria
- risks
- what not to build yet

## Readers

Maintainers, contributors, and AI agents selecting implementation work.

## Update Triggers

- phase order changes
- scope moves between V1 and later versions
- exit criteria change

## Agent Checks

Before implementation, agents must confirm the work belongs to the current phase.

## Phases

0. Documentation and standards foundation
1. Project skeleton and tooling
2. SQLite schema and migrations
3. Repo snapshot and worktree state
4. Evidence store
5. Trust Kernel and proof validation
6. Claims and layer isolation
7. Project rules ingestion
8. Symbol/file index and FTS
9. Current-valid retrieval
10. Context artifact compiler
11. Context diff engine and session locks
12. Lightweight compression cache
13. MCP server
14. CLI inspection/debugging
15. Benchmarks and hardening
16. Alpha release checklist

## Current Phase

Phase 0: Documentation and standards foundation.

No serious production feature implementation should start until Phase 0 exit criteria are met.

## Phase 0 Exit Criteria

- documentation architecture exists
- state machine is documented
- invariants are documented
- dependency direction is documented
- agent operating rules exist
- testing and benchmark standards exist
- changelog, spec changelog, implementation log, and ADR structure exist
