# V1 Storage

## Purpose

Define SQLite storage ownership, schema documentation, migrations, and concurrency rules.

## Required Contents

- table list and ownership
- repository interfaces
- migration rules
- WAL/concurrency behavior
- path normalization
- redaction persistence rules
- migration tests

## Readers

Storage, state, trust, compiler, diff, and session implementers.

## Update Triggers

- schema changes
- repository API changes
- migration behavior changes
- concurrency or lock behavior changes

## Agent Checks

Before editing storage behavior, agents must verify:

- no direct SQLite access outside storage repositories
- schema changes include migrations and tests
- storage does not contain business logic
- secret/redacted fields are handled correctly

## Minimum Tables

The implementation should expect tables for projects, repos, snapshots, worktree states, sources, claims, proofs, claim edges, symbols, rules, sessions, artifacts, dependencies, compression artifacts, sent items, omitted items, sync runs, command runs, test runs, and schema migrations.
