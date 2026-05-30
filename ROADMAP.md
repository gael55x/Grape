# Roadmap

Grape is a **local-first context transport layer** for coding agents: it compiles git-aware, proof-backed context from a repository, then ships only the **session-safe delta** each turn (`NEW`, `OMIT_UNCHANGED`, `INVALIDATE_PREVIOUS`, restore, pinned safety context).

It is not a chatbot, a cloud memory platform, or a full code-intelligence graph. Supporting compile features (snapshot, rules, excerpts, proofs, lightweight indexing) exist so the protocol is useful on real repos—not to duplicate heavyweight memory servers in V1.

Canonical protocol: [`docs/v1/contracts/context-diff.md`](docs/v1/contracts/context-diff.md). Product decision: [`docs/v1/decisions/adr-0010-context-transport-protocol.md`](docs/v1/decisions/adr-0010-context-transport-protocol.md).

Implementation detail and goal order: [`docs/v1/planning/implementation-roadmap.md`](docs/v1/planning/implementation-roadmap.md).

---

## North star

> Any MCP-capable agent on any git repo can call `grape_get_context`, receive a structured context pack diff, and pay fewer tokens on later turns without losing safety-critical or invalidated context.

---

## Phase 0 — Lock V1 story (docs)

**Goal:** One coherent contract before more feature surface.

| Deliverable | Status |
|-------------|--------|
| ADR-0010 Context Transport Protocol | Done |
| Roadmap + implementation roadmap phases | Done |
| SPEC §0 aligned with transport-first framing | Done |
| Feature filter documented (build / integrate / defer) | Done |

**Non-goals:** Rewriting all of `SPEC.md`; building embeddings or a 19-language graph product in V1.

---

## Phase 1 — V1 alpha: protocol you can ship

**Goal:** Prove the transport wedge on a real repo with installable CLI/MCP.

### 1A — Publish path

- npm publish `grape-context` (semver `0.1.0-alpha.x`)
- CI install smoke: pack → install → `init` → `compile` ×2 → `doctor`
- Package includes CLI + runtime SQL migrations (existing `package:check`)

### 1B — Protocol hardening (differentiator)

- Golden tests for full `ContextPackItem` envelopes
- Branch switch, session reset, dependency stale → `INVALIDATE_PREVIOUS` benchmarked
- Stable `artifactFormatVersion` / wire contract docs
- Restore path documented and tested (stale restore fails closed)

### 1C — Minimum compiler (features for the diff)

- Task retrieval + exact spans good enough on a real TypeScript repo
- Pinned rules, high-risk gate, narrow source-excerpt proofs/claims
- Token budget: required context never pruned

### 1D — Proof it works

- At least three benchmark scenarios (clean app, branch switch, stale file)
- Public metrics: turn-1 vs turn-2 tokens, `OMIT_UNCHANGED` count, unsafe omissions = 0

**Alpha exit:** `npm install -g` → `grape init --connect` → `grape_get_context` twice same session → second response omits safely; file change invalidates prior sends.

---

## Phase 1.5 — Daily-use compile features

**Goal:** Compilation is strong enough that teams keep Grape enabled; protocol API unchanged.

- Grape-observed command/test proofs
- More durable claim types + user-confirmed decisions
- Parsed durable project rules + scope
- Conflict detection (inspectable edges first)
- Richer exact-span ranking
- Optional **integration** doc: external graph MCP supplies refs; Grape still outputs pack diffs

---

## Phase 2 — Deeper compile, same protocol

**Goal:** Broader memory/trust without changing the outward pack contract.

- Broader durable current-valid retrieval (less scaffold projection)
- Optional local embeddings over allowed sources only
- `grape export` / `grape purge` when privacy contracts exist
- Multi-fixture benchmark suite + published baselines
- Cross-platform CI hardening (Windows/WSL)

---

## Phase 3 — Ecosystem (optional)

- Optional auto-sync hooks (every-turn repo refresh)
- Multi-repo / team sync only after single-repo transport is boringly reliable

---

## Now (current codebase)

What exists today on `main`:

- local `.grape/` bootstrap, SQLite ledger, Git snapshot + privacy-safe scanning
- lightweight file / lexical / symbol indexing
- `grape compile` / `grape_get_context` with session-scoped diffing
- `OMIT_UNCHANGED`, `PINNED`, `INVALIDATE_PREVIOUS`, restore lookup
- CLI/MCP inspection (`artifacts`, `stale`, `omitted`, `doctor`, …)
- one benchmark fixture (`clean-typescript-app`); package dry-run ready; **not published to npm yet**
- scaffold-backed public artifacts (see [`context-artifact.md`](docs/v1/contracts/context-artifact.md))

---

## Next (immediate engineering after Phase 0 docs)

1. npm publish + install smoke CI  
2. Protocol golden tests + extra fixtures  
3. Compiler hardening for turn-1 usefulness  
4. Tag `v0.1.0-alpha.1`

---

## Later (explicit non-goals for V1)

- Docker Compose memory server as a requirement
- 19-language Leiden graph as the hero feature
- Default cloud embeddings or team sync
- Competing on hybrid memory search latency vs dedicated memory products
- Full chat-session ingestion pipeline before pack diff is proven via npm

---

## Non-Goals

Grape should not become:

- a chatbot
- an IDE clone
- an autonomous patch runner
- a cloud memory platform by default
- a generic knowledge graph product
- a production observability connector
- a complete code intelligence engine
