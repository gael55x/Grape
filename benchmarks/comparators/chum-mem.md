# chum-mem comparator

- **Repo:** https://github.com/sly-codechum/chum-mem
- **License:** GPL-3.0
- **Benchmark decision:** `benchmark partially`
- **Comparison class:** `trust/retrieval` (PCKC proof-carrying memory)

## Comparable dimensions

- Claim extraction and proof behavior
- Current-valid retrieval
- Context pack / minimal proof sets
- Contradiction/supersession (if enabled)

## Not applicable

- Grape-style session diff transport unless MCP compile path wired identically
- npm global install parity (Docker Compose required)

## Setup (manual)

Requires Docker, Postgres, Chroma per upstream README. Not run in default `bench:comparators` (skipped automatically).

## Fair comparison notes

- Closest architectural peer to Grape trust kernel (SPEC §2.7)
- GPL limits redistributing bundled comparison harnesses without review
- Compare proof/current-valid behavior, not turn-2 omission ratio
