# Roadmap

Grape is being built as a local-first context compiler for AI coding agents. The roadmap is intentionally narrow: make the artifact useful, inspectable, and safe before adding broader integrations.

## Now

What a reviewer can verify from a clone today (`npm ci`, `npm run build`, `npm run check`, then `node dist/cli/index.js …`):

- local bootstrap with `grape init --connect`, `grape status`, and `grape doctor`, including repairable malformed config and unusable-database recovery
- Git-backed repository snapshot, worktree state, and privacy-safe allowed-source scanning
- lightweight file, lexical, symbol, and relationship indexing over allowed snapshot sources
- conservative task source retrieval from task text plus optional file/symbol/test seed refs
- proof-backed exact source excerpts with dependency hashes and current source validation (narrow claim type today)
- session-scoped context diffing with `OMIT_UNCHANGED`, `PINNED`, `INVALIDATE_PREVIOUS`, and restore lookup
- optional token budgets that protect required pinned/exact/invalidation context
- CLI and MCP inspection for status, doctor, artifacts, sessions, stale items, claims, proofs, conflicts, rules, and omitted context
- one scripted benchmark fixture: `grape bench --fixture clean-typescript-app`
- package dry-run checks proving a future global install would include the CLI and runtime migrations
- behavior tests, docs checks, architecture checks, storage checks, typecheck, and package checks

Not in the current review bar: published npm install, `grape export`/`grape purge`, Grape-observed runners, full semantic indexing, multi-fixture benchmarks, or finished durable-truth artifact retrieval.

## Next

These are the strongest follow-up slices after the current review target:

- broader exact-span ranking across symbol ranges, tests, config, and multiple task anchors
- Grape-observed command and test runners that can create trusted execution proofs
- broader durable claim types with contradiction and supersession handling
- parsed durable project rules with scope resolution and conflict detection
- richer compression replacement policy without allowing summaries to become proof
- stronger partial-bootstrap repair for interrupted local setup
- broader fixture benchmark corpus with real token-reduction and safety thresholds
- npm publication checklist and release hardening (without treating publish as proof of product completeness)

## Later

These stay out of the current implementation target unless the core artifact contract needs them:

- model-assisted summaries as non-authoritative orientation
- hybrid semantic search over already-allowed local inputs
- framework-specific extractors for common stacks
- imported CI or runtime evidence with verifiable hashes
- multi-repo context once single-repo artifacts are reliable
- team sync or cloud sync after the local trust boundary is proven

## Non-Goals

Grape should not become:

- a chatbot
- an IDE clone
- an autonomous patch runner
- a cloud memory platform
- a generic knowledge graph
- a production observability connector
- a complete code intelligence engine
