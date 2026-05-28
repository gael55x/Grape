# ADR-0009: Lexical Search Runtime Portability

## Status

Accepted

## Context

Grape V1 uses Node's built-in `node:sqlite` runtime to preserve the two-command setup goal and avoid native package installation. The original V1 storage contract named FTS5 as the lexical search mechanism. In practice, Node builds can expose `node:sqlite` while differing in bundled SQLite extension support. A runtime that lacks FTS5 can fail local bootstrap before Grape can provide useful recovery guidance.

That failure mode conflicts with the V1 setup requirement:

```text
npm install -g grape-context
grape init --connect
```

The V1 lexical index is currently a conservative source-selection aid. It is not durable truth, not proof, not current-valid retrieval, and not a release-quality relevance engine.

## Decision

Use a normal SQLite `fts_entry_text` table plus application-owned deterministic lexical matching for V1 source search. Keep the existing `fts_entries` and `fts_entry_text` table names for compatibility with already-created local databases, but do not require the SQLite FTS5 extension for new bootstrap.

The migration planner accepts the previous FTS5 migration checksum for migration `0003` as a documented compatible checksum so existing local databases are not rejected only because the implementation moved from FTS5-backed search to portable table-backed lexical search.

## Consequences

- Grape setup is less sensitive to the exact Node/SQLite build.
- V1 keeps the `node:sqlite` no-native-dependency path from ADR-0004.
- Lexical search remains deterministic and local-first.
- Search ranking is intentionally weaker than FTS5 ranking.
- The index remains a task-source selection aid only; proof, claims, and current-valid filtering remain separate.

## Alternatives

- Keep FTS5 mandatory. Rejected because it makes setup fragile across Node builds.
- Add `better-sqlite3`. Rejected for V1 because native package installation can break the simple global setup path.
- Add a WASM SQLite fallback. Deferred because it is a larger storage-runtime decision than V1 currently needs.

## Supersedes

This narrows the FTS5 requirement in ADR-0004 and supporting storage docs. ADR-0004 still owns the Node 22.5+ `node:sqlite` runtime decision.

## Related Spec Sections

- `docs/v1/SPEC.md` storage and indexing sections.
- `docs/v1/core/storage.md`
- `docs/v1/interfaces/cli.md`
- `docs/v1/interfaces/mcp-tools.md`
