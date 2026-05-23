# V1 Context Diff

## Purpose

Define the session-scoped context delta protocol.

## Required Contents

- canonical `DiffState` values
- sent item ledger
- omitted item behavior
- restore protocol
- invalidation behavior
- pinned context rules

## Readers

Diff, sessions, compiler, MCP, CLI, and test implementers.

## Update Triggers

- diff state changes
- sent-item schema changes
- restore behavior changes
- session reset or branch switch behavior changes

## Agent Checks

Before editing diff behavior, agents must verify:

- diff is session-scoped
- pinned safety context is resent when required
- omitted items have safe reasons and restore metadata when restorable
- stale previous context emits `INVALIDATE_PREVIOUS`

## Canonical Diff States

```text
NEW
CHANGED
PINNED
OMIT_UNCHANGED
INVALIDATE_PREVIOUS
RESTORE_AVAILABLE
```
