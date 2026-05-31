# Roadmap

Grape is a **local-first context transport layer** for coding agents: it compiles git-aware, proof-backed context from a repository, then ships only the **session-safe delta** each turn (`NEW`, `OMIT_UNCHANGED`, `INVALIDATE_PREVIOUS`, restore hints, and pinned safety context).

It is not a chatbot, a cloud memory platform, or a full code-intelligence graph. Supporting compile features such as snapshots, rules, excerpts, proofs, lightweight indexing, and compression exist so the transport protocol is useful on real repos.

Canonical protocol: [`docs/v1/contracts/context-diff.md`](docs/v1/contracts/context-diff.md). Agent session contract: [`docs/v1/interfaces/agent-sessions.md`](docs/v1/interfaces/agent-sessions.md). Product decision: [`docs/v1/decisions/adr-0010-context-transport-protocol.md`](docs/v1/decisions/adr-0010-context-transport-protocol.md). Implementation detail and goal order: [`docs/v1/planning/implementation-roadmap.md`](docs/v1/planning/implementation-roadmap.md).

## North Star

Any MCP-capable agent on any git repo can call `grape_get_context`, receive a structured context pack diff, and pay fewer tokens on later turns without losing safety-critical or invalidated context.

## Release Shape

| Stage | Meaning |
|---|---|
| Alpha | Protocol works. The CLI/MCP transport can install, initialize, return a context pack, safely omit unchanged same-session context, restore omitted context, and invalidate stale prior sends. |
| Beta | Workflow works. A normal agent can use the happy path with clear install/setup docs, predictable task/session identity, useful mismatch recovery, reproducible smoke/benchmark coverage, and fewer manual debug steps. |
| 1.0 | Stable safe contract. Public schemas, setup behavior, session safety, restore/invalidation semantics, and local privacy guarantees are stable enough for broad use. |

## Done

- `grape-context@0.1.0-alpha.2` is published on npm and has a GitHub release.
- The context transport wedge is proven through CLI and MCP `grape_get_context`.
- MCP stdio smoke exists, including framed JSON-RPC transport.
- Same-session two-turn omission works when task/session identity is stable.
- `PINNED`, `OMIT_UNCHANGED`, `RESTORE_AVAILABLE`, and `INVALIDATE_PREVIOUS` are implemented in the current transport slice.
- Branch, dependency, session reset, and restore-path invalidation are proven through behavior coverage.
- Packaged install smoke selects the exact just-packed tarball, asserts installed package metadata, exercises MCP `initialize` / `tools/list`, proves two-turn context diffing, and restores an omitted item.
- Alpha e2e smoke uses a repo-local npm cache, selects the exact just-packed tarball, asserts installed package metadata, and exercises installed MCP stdio setup.
- Branch-switch and stale-source fixture metadata now matches their invalidation benchmark behavior.
- The session reset fixture benchmark proves reset invalidation, safe full resend, and zero reset-turn omissions.
- Restore-path golden tests lock `RESTORE_AVAILABLE` restore IDs, session binding, restored body shape, and MCP no-root-path output.
- The benchmark workspace reports 13/13 scripted scenarios passing when run with the documented methodology and stable task/session contract.
- In-repo `grape bench` fixtures cover clean, branch-switch, stale-source, and session-reset scenarios.
- Package dry-run and install smoke are part of the local gate.

## Now

- Finish the remaining approval-gated alpha closeout: package-lock metadata alignment, external benchmark workspace dependency alignment, and any published/global registry smoke rerun.
- Decide and implement a dedicated task/session mismatch exit classification after approval.
- Keep the seamless beta path explicit: install Grape, initialize once, keep using the coding agent normally, and let MCP `grape_get_context` handle context diffs in the background.

## Next

- Optional `0.1.0-alpha.3` after the remaining alpha closeout gates are approved and green.
- Beta candidate only after install/connect/recover flows are boring across clean consumer repos and the documented smoke/benchmark suite is reproducible.

## Soon

- Better TypeScript compiler retrieval and exact-span ranking.
- Grape-observed command/test recording with trusted run evidence.
- Stronger trust/proof depth and broader durable claim types.
- Broader fixtures and labeled benchmark expectations.
- Better dirty-worktree, branch, and session handling for normal agent workflows.
- Parsed durable project rules and richer conflict creation/resolution.

## Later

- Optional local embeddings over allowed sources.
- Rust or other performance rewrites only after the contract is stable.
- Cloud/team sync after single-repo local transport is boringly reliable.
- Full graph extraction and richer code-intelligence integrations.
- Memory-platform features outside the V1 transport wedge.
- IDE plugins and deeper agent-client integrations.
- Stable `1.0.0`.

## Alpha Exit Check

The current alpha path is:

```bash
npm install -g grape-context@0.1.0-alpha.2
grape init --connect
```

Then an MCP client calls `grape_get_context` twice with the same task/session identity. The second response should omit unchanged non-pinned context safely, and a depended file, branch change, or explicit reset should invalidate prior sends instead of silently reusing stale context.

## Beta Readiness Bar

Beta readiness is not a bigger feature list. It means the current transport slice is boring to install, connect, inspect, and recover from:

- setup docs match the published package and Node runtime
- agent session/task identity is explicit and testable
- common mismatch and stale-cache failures have recovery guidance
- install smoke, MCP stdio smoke, restore, invalidation, and benchmark checks are reproducible
- known scaffold and retrieval limitations are visible before users rely on them

## Non-Goals For V1

Grape should not become:

- a chatbot
- an IDE clone
- an autonomous patch runner
- a cloud memory platform by default
- a generic knowledge graph product
- a production observability connector
- a complete code intelligence engine
