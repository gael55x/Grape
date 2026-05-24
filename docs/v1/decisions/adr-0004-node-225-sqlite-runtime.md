# ADR-0004: Node 22.5 SQLite Runtime

## Status

Accepted

## Context

Grape V1 needs local SQLite storage without making contributors install or compile a native SQLite package. The committed implementation uses Node's built-in `node:sqlite` module for migration and repository tests.

`node:sqlite` is available starting in Node 22.5. A Node 20 runtime contract would require a separate SQLite driver or a conditional fallback path.

## Decision

Grape V1 requires Node.js 22.5 or newer for the initial implementation path.

The storage runtime will use `node:sqlite` and must keep SQLite driver-specific code inside `src/core/storage/`. The project will not add a native SQLite package unless a later ADR accepts the added install and support cost.

## Consequences

- The package engine range must be `>=22.5.0`.
- CI must run on Node 22.5 or newer.
- Documentation must not advertise Node 20 support.
- Basic install remains native-package-free for the storage path.
- A future Node 20 fallback would require a new ADR, compatibility tests, and storage-driver boundary documentation.

## Alternatives

- Keep Node 20 support and add a native SQLite package. Rejected for V1 because native install failures would make the local-first tool harder to adopt.
- Keep Node 20 support and defer runtime SQLite. Rejected because the next Grape proof depends on durable session ledgers.

## Related Spec Sections

- Runtime
- Storage
- SQLite Schema And Migrations
