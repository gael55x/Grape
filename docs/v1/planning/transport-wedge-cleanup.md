# Transport Wedge Cleanup

## Purpose

Record the alpha.3 alignment work that sharpens Grape's product wedge: **local-first, session-scoped context transport** via MCP/CLI—not a daemon, memory platform, or full repo graph.

## Completed

- Replaced vague "background" product language with **MCP-driven session tracking** and stable session identity requirements.
- Made `grape init --connect` print a concrete MCP command, agent instruction block, and session transport notes.
- Aligned MCP `serverInfo.version` with `package.json` (`0.1.0-alpha.3`).
- Populated `src/core/sessions/` with session transport policy vocabulary; documented durable ownership in storage/app layers.
- Added `grape diff-context --explain` for compact per-item diff reasons.
- Strengthened behavior tests for dirty/delete/rename/manifest transport cases.
- Updated SPEC, architecture, agent-sessions, security, and beta-readiness docs with implemented vs deferred labels.

## Remaining beta blockers (honest)

- Real MCP client trials (Cursor, Claude Code, etc.) against the published package.
- Cross-platform CI coverage beyond current gates.
- Public schema/contract freeze for transport JSON.
- Turn-1 retrieval quality hardening for non-TS/JS repos.
- Dirty-worktree invalidation at full spec fidelity (dependency-hash drift covers many cases; explicit worktree-hash ledger invalidation may still be partial).

## Verification

```bash
npm run typecheck
npm run test:behavior
npm run architecture:check
npm run docs:check
npm run check
```
