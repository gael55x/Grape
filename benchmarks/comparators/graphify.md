# Graphify comparator

- **Package:** PyPI `graphifyy` (CLI: `graphify`)
- **Install:** `uv tool install graphifyy` or `pip install graphifyy`
- **Benchmark decision:** `benchmark partially`
- **Comparison class:** `orientation` (repo graph query, not session diff transport)

## Comparable dimensions

- Coding repo awareness (AST graph)
- Project indexing time
- Query usefulness on fixture task
- Artifact size (`graph.json`)

## Not applicable

- Session diff transport (`OMIT_UNCHANGED`, `RESTORE_AVAILABLE`)
- Proof-backed claims
- Stale-context invalidation at Grape granularity
- MCP `grape_get_context` parity

## Scripted run

```bash
graphify update <fixture-path> --output <out-dir>
graphify query "<task>" --graph <out-dir>/graphify-out/graph.json --budget 2000
```

Or: `npm run bench:comparators -- --tool=graphify`

## Known limitations

- Small fixture graphs may not satisfy Graphify's built-in `benchmark` sample questions
- Record as structural orientation only (see `beta-readiness.md` external trial notes)
