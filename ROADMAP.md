# Roadmap

Grape is a **local-first context compiler and context transport layer** for coding agents: it compiles git-aware, proof-backed context from a repository, then ships only the **session-safe delta** each turn (`NEW`, `OMIT_UNCHANGED`, `INVALIDATE_PREVIOUS`, restore hints, and pinned safety context).

It is not a chatbot, a cloud memory platform, or a full code-intelligence graph. Supporting compile features such as snapshots, rules, excerpts, proofs, lightweight indexing, and compression exist so the transport protocol is useful on real repos.

Canonical protocol: [`docs/v1/contracts/context-diff.md`](docs/v1/contracts/context-diff.md). Agent session contract: [`docs/v1/interfaces/agent-sessions.md`](docs/v1/interfaces/agent-sessions.md). Language/provider boundary: [`docs/v1/core/language-indexing.md`](docs/v1/core/language-indexing.md). Product decision: [`docs/v1/decisions/adr-0010-context-transport-protocol.md`](docs/v1/decisions/adr-0010-context-transport-protocol.md). Implementation detail and goal order: [`docs/v1/planning/implementation-roadmap.md`](docs/v1/planning/implementation-roadmap.md).

## North Star

Any MCP-capable agent on any git repo can call `grape_get_context`, receive a structured context pack diff, and omit unchanged same-session context on later turns when task and session identity stay stable, without losing safety-critical or invalidated context. Grape includes benchmark fixtures and scripts for local comparison; numeric savings are fixture estimates only when tied to committed raw result files and their caveats.

## Release Shape

| Stage | Meaning |
|---|---|
| Alpha | Protocol works. The CLI/MCP transport can install, initialize, return a context pack, safely omit unchanged same-session context, restore omitted context, and invalidate stale prior sends. |
| Beta | Workflow works. A normal agent can use the happy path with clear install/setup docs, predictable task/session identity, useful mismatch recovery, reproducible smoke/benchmark coverage, and fewer manual debug steps. |
| 1.0 | Stable safe contract. Public schemas, setup behavior, session safety, restore/invalidation semantics, and local privacy guarantees are stable enough for broad use. |

## Done

- `grape-context@0.1.0-alpha.2` and `0.1.0-alpha.3` are published on npm with GitHub releases (historical alpha milestones).
- `grape-context@1.0.0-beta.5` is published on npm under the `latest` and `beta` dist-tags. `1.0.0-beta.0` remains the first beta tag and the version tied to the first committed post-beta benchmark baseline.
- The context transport wedge is proven through CLI and MCP `grape_get_context`.
- MCP stdio smoke exists, including framed JSON-RPC transport.
- Same-session two-turn omission works when task/session identity is stable.
- `PINNED`, `OMIT_UNCHANGED`, `RESTORE_AVAILABLE`, and `INVALIDATE_PREVIOUS` are implemented in the current transport slice.
- Branch, dependency, session reset, and restore-path invalidation are proven through behavior coverage.
- Packaged install smoke selects the exact just-packed tarball, asserts installed package metadata, exercises CLI help/init/two-turn compile, restores omitted CLI context, proves task/session mismatch recovery, proves reset recovery, exercises MCP `initialize` / `tools/list`, proves two-turn MCP context diffing, and restores an omitted MCP item.
- Alpha e2e smoke uses a repo-local npm cache, selects the exact just-packed tarball, asserts installed package metadata, and exercises installed MCP stdio setup.
- Branch-switch and stale-source fixture metadata now matches their invalidation benchmark behavior.
- The session reset fixture benchmark proves reset invalidation, safe full resend, and zero reset-turn omissions.
- Restore-path golden tests lock `RESTORE_AVAILABLE` restore IDs, session binding, restored body shape, and MCP no-root-path output.
- Task/session mismatch now has a dedicated CLI exit classification instead of falling through the storage/schema bucket.
- Package-lock metadata is aligned with the current beta version/runtime.
- Global install smoke passed against historical `grape-context@0.1.0-alpha.3`.
- Published-package smoke passed against registry-installed alpha.3 in the external benchmark workspace during the alpha-to-beta path.
- The external benchmark workspace reports scripted transport scenarios passing under its documented methodology and stable task/session contract. Those are local fixture results, not production performance evidence or superiority proof.
- In-repo `grape bench` fixtures cover clean, branch-switch, stale-source, session-reset, polyglot fallback, and monorepo-lite scenarios.
- Package dry-run and install smoke are part of the local gate.
- `npm run beta:client-trial` proves packaged-install MCP stdio transport, including omission, restore, invalidation, reset, branch change, redaction, and ignored secret-looking file rejection.
- `npm run beta:check` runs `check`, `benchmark:run`, `e2e:alpha`, and `beta:client-trial`.
- GitHub Actions `beta-smoke` runs `benchmark:run`, `e2e:alpha`, and `beta:client-trial` after the cross-platform `check` matrix.
- Local `grape run` / `grape test` can promote narrow `grape_observed_run_result` proofs/claims from trusted observed run metadata.
- The language-provider boundary is documented: TypeScript/JavaScript AST graph extraction is proven; Python, Go, Rust, Java, C#, Ruby, PHP, Swift, Kotlin, C, C++, shell, JSON, YAML, TOML, and explicit Markdown paths use safe exact/path/lexical fallback only until providers and fixtures prove stronger graph support.

## Now

- Post-beta benchmark validation has a first committed published-package run for `grape-context@1.0.0-beta.0` against naive and search baselines across retrieval, bug-fix, and documentation tasks. It supports fixture-level retrieval and noise findings, not token-size savings against those baselines.
- Record human MCP client trials from [`docs/v1/planning/beta-trial-checklist.md`](docs/v1/planning/beta-trial-checklist.md) when release policy requires Cursor, Claude Code, or equivalent IDE UI proof beyond automated `beta:client-trial`.
- Keep future version bumps, tags, GitHub releases, npm publishes, and dist-tag changes approval-gated.

## Next

- Repeat post-beta benchmark runs across more tasks and tune retrieval where the published-beta results show known noise, missed files, or high serialized output cost.

## Soon

- Better TypeScript compiler retrieval and exact-span ranking.
- Stronger trust/proof depth beyond the narrow observed-run result claim.
- Broader durable claim types.
- Broader benchmark fixtures and labeled benchmark expectations.
- Provider capability diagnostics plus deeper polyglot and monorepo scenarios.
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

## Beta Install Check

**Published beta:**

```bash
npm install -g grape-context@beta
grape init --connect
```

Then an MCP client calls `grape_get_context` twice with the same task/session identity. The second response should omit unchanged non-pinned context safely, and a depended file, branch change, or explicit reset should invalidate prior sends instead of silently reusing stale context.

## Beta Readiness Bar

Beta readiness is not a bigger feature list. It means the current transport slice is boring to install, connect, inspect, and recover from:

- setup docs match the published package and Node runtime
- agent session/task identity is explicit and testable
- common mismatch and stale-cache failures have recovery guidance
- install smoke, MCP stdio smoke, packaged `beta:client-trial`, restore, invalidation, and benchmark checks are reproducible
- known artifact and retrieval limitations are visible before users rely on them

## Non-Goals For V1

Grape should not become:

- a chatbot
- an IDE clone
- an autonomous patch runner
- a cloud memory platform by default
- a generic knowledge graph product
- a production observability connector
- a complete code intelligence engine
