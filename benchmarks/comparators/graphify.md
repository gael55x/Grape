# Graphify comparator

- **Package:** PyPI `graphifyy` (CLI: `graphify`)
- **Install:** `uv tool install graphifyy` or `pip install graphifyy`
- **Benchmark decision:** `benchmark partially`
- **Comparison class:** `orientation` (one-shot repo graph query, not a full multi-turn Graphify assistant workflow)

## Fair positioning

Graphify is strongest at building a queryable repo knowledge graph. Grape is strongest at preserving safe context continuity across agent turns with session diff, restore, invalidation, and proof-backed excerpts.

This harness measures one-shot Graphify CLI orientation only. It does not measure Graphify's full MCP, update, hook, IDE, or multi-turn assistant workflow.

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
- Do not describe this comparator as proof that Grape beats Graphify or that Graphify lacks a multi-turn workflow.

## Future fair scenario

A fuller comparison should run the same repo and task through both tools with first request, second same-session continuation, source edit, branch or dependency change, task wording drift, restore/recovery, and a high-risk auth/security/payment/deployment task. Measure stale assumptions, rereads, token volume, context correctness, agent success, and recovery quality.
