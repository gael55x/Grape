# Roadmap

Grape is a **local-first context transport layer** for coding agents: it compiles git-aware, proof-backed context from a repository, then ships only the **session-safe delta** each turn (`NEW`, `OMIT_UNCHANGED`, `INVALIDATE_PREVIOUS`, restore, pinned safety context).

It is not a chatbot, a cloud memory platform, or a full code-intelligence graph. Supporting compile features (snapshot, rules, excerpts, proofs, lightweight indexing) exist so the protocol is useful on real repos—not to duplicate heavyweight memory servers in V1.

Canonical protocol: [`docs/v1/contracts/context-diff.md`](docs/v1/contracts/context-diff.md). Product decision: [`docs/v1/decisions/adr-0010-context-transport-protocol.md`](docs/v1/decisions/adr-0010-context-transport-protocol.md).

Implementation detail and goal order: [`docs/v1/planning/implementation-roadmap.md`](docs/v1/planning/implementation-roadmap.md).

---

## North star

> Any MCP-capable agent on any git repo can call `grape_get_context`, receive a structured context pack diff, and pay fewer tokens on later turns without losing safety-critical or invalidated context.

---

## Done (foundation)

| Area | Status |
|------|--------|
| ADR-0010 Context Transport Protocol | Done |
| Roadmap + implementation roadmap | Done |
| SPEC §0 aligned with transport-first framing | Done |
| Feature filter (build / integrate / defer) | Done |
| `grape-context@0.1.0-alpha.1` on npm | Done |
| Install smoke in `npm run check` | Done |
| `grape` bin after `npm install` | Done |

**Non-goals for this slice:** Rewriting all of `SPEC.md`; building embeddings or a 19-language graph product in V1.

---

## Now (current codebase)

What exists on `main` today:

- local `.grape/` bootstrap, SQLite ledger, Git snapshot + privacy-safe scanning
- lightweight file / lexical / symbol indexing
- `grape compile` / `grape_get_context` with session-scoped diffing
- `OMIT_UNCHANGED`, `PINNED`, `INVALIDATE_PREVIOUS`, restore lookup
- CLI/MCP inspection (`artifacts`, `stale`, `omitted`, `doctor`, …)
- one benchmark fixture (`clean-typescript-app`)
- published npm package [`grape-context`](https://www.npmjs.com/package/grape-context) (`0.1.0-alpha.1`)
- scaffold-backed public artifacts (see [`context-artifact.md`](docs/v1/contracts/context-artifact.md))

**Alpha exit criteria:** `npm install -g grape-context` → `grape init --connect` → `grape_get_context` twice in the same session → second response omits safely; a depended file change invalidates prior sends.

---

## Next (priority order)

Work through these in order. Each item should land with tests and doc updates where behavior changes.

### 1. CI and runtime reliability

- [x] CI on Node 22.13+ (`node:sqlite` without `--experimental-sqlite`)
- [x] Install smoke passes spawned `grape` on the same Node policy
- [ ] Git tag `v0.1.0-alpha.2` on the published commit (if not already)

### 2. Protocol hardening (differentiator)

- [x] Golden tests for `ContextPackItem` envelopes (`context-pack-protocol-golden.test.mjs`)
- [x] Branch switch and stale-source `INVALIDATE_PREVIOUS` benchmarks
- [x] Stable `artifactFormatVersion` documented in `context-diff.md`
- [ ] Session reset scenario benchmark (behavior tests exist; fixture bench pending)
- [ ] Restore path golden beyond existing stale-restore behavior tests

### 3. Compiler quality (supports the diff)

- Task retrieval + exact spans good enough on a real TypeScript repo
- Pinned rules, high-risk gate, narrow source-excerpt proofs/claims
- Token budget: required context never pruned

### 4. Benchmark evidence

- [x] Three fixture scenarios wired to `grape bench` (clean, branch switch, stale source)
- [ ] Published baseline metrics in docs (turn-1 vs turn-2 tokens from CI or manual run log)

---

## Soon (daily-use compile, same protocol API)

- Grape-observed command/test proofs
- More durable claim types + user-confirmed decisions
- Parsed durable project rules + scope
- Conflict detection (inspectable edges first)
- Richer exact-span ranking
- Optional integration doc: external graph MCP supplies refs; Grape still outputs pack diffs

---

## Later (deeper compile, same protocol)

- Broader durable current-valid retrieval (less scaffold projection)
- Optional local embeddings over allowed sources only
- `grape export` / `grape purge` when privacy contracts exist
- Multi-fixture benchmark suite + published baselines
- Cross-platform CI hardening (Windows/WSL)

---

## Optional (ecosystem)

- Optional auto-sync hooks (every-turn repo refresh)
- Multi-repo / team sync only after single-repo transport is boringly reliable

---

## Explicit non-goals (V1)

- Docker Compose memory server as a requirement
- 19-language Leiden graph as the hero feature
- Default cloud embeddings or team sync
- Competing on hybrid memory search latency vs dedicated memory products
- Full chat-session ingestion pipeline before pack diff is proven on npm

---

## Non-Goals (product shape)

Grape should not become:

- a chatbot
- an IDE clone
- an autonomous patch runner
- a cloud memory platform by default
- a generic knowledge graph product
- a production observability connector
- a complete code intelligence engine
