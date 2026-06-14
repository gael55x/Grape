# Getting Started with Grape

Grape is a local-first context compiler and transport layer for AI coding agents on Git repositories. It compiles task-specific context from repo state, tracks what each agent session already received, and sends only the useful delta on later turns.

Grape is not a chatbot and does not send your repository to a remote Grape service by default.

## When to use Grape

Use Grape when an AI coding agent works across many turns on the same repository and you want:

- dependency-tracked context artifacts instead of rereading the same files every turn
- session-scoped diffs (`NEW`, `CHANGED`, `PINNED`, `OMIT_UNCHANGED`, `RESTORE_AVAILABLE`, `INVALIDATE_PREVIOUS`)
- local privacy controls and proof-backed excerpts

## Requirements

- Node.js 22.13 or newer
- npm
- Git

## Install

```bash
npm install -g grape-context@beta
grape help
grape doctor
```

If install resolves an older package, clear the npm cache and reinstall:

```bash
npm cache clean --force
npm install -g grape-context@beta
```

## Initialize a repository

From your repository root:

```bash
grape init --connect
```

This creates local state under `.grape/`, captures the first Git snapshot, and prints MCP setup guidance.

Review local privacy settings:

```bash
grape doctor --privacy
```

Grape adds `.grape/` to `.git/info/exclude` so local runtime state stays out of Git.

## Connect your coding agent (MCP)

Grape works best through MCP. Print a client-ready config:

```bash
grape mcp --print-config
```

A typical stdio MCP entry (replace `<repo-root>` with your repository path):

```json
{
  "mcpServers": {
    "grape": {
      "command": "grape",
      "args": ["mcp", "--stdio", "--repo", "<repo-root>"],
      "cwd": "<repo-root>"
    }
  }
}
```

The `cwd` and `--repo` path must point at the same repository root.

Primary tool: `grape_get_context`. See [`mcp-tools.md`](mcp-tools.md) for the full tool list.

## Normal agent loop

On each turn, the agent calls `grape_get_context` with:

- `query`: the current task text (keep wording stable for continued turns)
- `sessionId`: a stable ID for this agent session, or `agentName` plus `agentSessionId`
- `outputMode`: `agent_pack` (default) for compact transport deltas

Read `NEW` and `PINNED` items first. Handle `OMIT_UNCHANGED`, `RESTORE_AVAILABLE`, and `INVALIDATE_PREVIOUS` before trusting prior context.

Session rules and recovery paths: [`agent-sessions.md`](agent-sessions.md).

## CLI fallback workflow

Use the CLI for debugging, scripts, or agents without MCP.

Typical sequence:

```bash
grape status
grape doctor
grape sync
grape compile --task "Explain checkout discount behavior" --session my-session --json
grape diff-context --task "Explain checkout discount behavior" --session my-session
grape run --session my-session -- npm test
grape sessions
grape stale
grape omitted --session my-session
```

`grape compile` and `grape diff-context` accept the same task and session flags. `grape diff-context --explain` shows per-item diff reasons without full bodies.

Observed runs require an existing session from compile or MCP:

```bash
grape test --session my-session -- pnpm test
```

## What to expect

After `grape init --connect`:

- `.grape/config.json` and `.grape/grape.db` hold local project state
- scan diagnostics report visible and rejected files

After `grape compile --task <text>`:

- JSON and Markdown artifacts under `.grape/artifacts/`
- a `sessionId` and `contextPackItems` with diff states

After MCP `grape_get_context`:

- compact pack items for agent transport
- `recoveryGuidance` when Grape cannot compile safely

## Common errors

| Symptom | What to do |
|---|---|
| `Grape config is missing` | Run `grape init --connect` from the repository root. |
| `context session task mismatch` | Reuse the same `--task` and `--task-type`, or choose a new `--session`. |
| Context session not found (run/test) | Run `grape compile --task "<task>" --session <id>` first, or list sessions with `grape sessions`. |
| Stale context session | Rerun `grape compile` for the same task and session, or start a new `--session`. |
| `benchmark fixture not found` | Use `grape bench --fixture <name>` with a fixture under `tests/fixtures/`, or pass `--fixture-path`. |
| Feature flags not allowlisted | Add flag names to the scope allowlist in `.grape/config.json`, or omit `--feature-flags`. |

## Beta limits

Grape 1.0 beta focuses on local context transport. It does not promise cloud memory, embeddings search, or production-grade multi-tenant hosting. See the root [`README.md`](../../../README.md) for the current "not promised yet" list.

## Related docs

- Session identity and recovery: [`agent-sessions.md`](agent-sessions.md)
- CLI commands and exit codes: [`cli.md`](cli.md)
- MCP tool schemas: [`mcp-tools.md`](mcp-tools.md)
