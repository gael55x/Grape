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
grape --version
grape help
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

Run setup diagnostics after initialization:

```bash
grape doctor
```

Review local privacy settings:

```bash
grape doctor --privacy
```

Grape adds `.grape/` to `.git/info/exclude` so local runtime state stays out of Git.

## Connect Your Coding Agent With MCP

Grape works best when your coding agent can call MCP tools during a task.

Choose the client you use:

- Cursor: run `grape mcp --install --client cursor` from the repository root.
- Claude Desktop: run `grape mcp --install --client claude` from the repository root.

Then restart or reload the MCP client if it does not pick up config changes automatically. Ask the agent to call `grape_get_context` at the start of each repo task, and keep the same `sessionId` and task text for continued turns on the same task.

Cursor auto-install writes project-local `.cursor/mcp.json`. Claude Desktop auto-install writes `claude_desktop_config.json` when Grape can resolve the platform path safely.

Preview the config without writing:

```bash
grape mcp --install --client cursor --dry-run
grape mcp --install --client claude --dry-run
```

If an existing `mcpServers.grape` entry differs, Grape refuses to replace it unless you pass `--force`. It preserves unrelated MCP server entries.

Other clients remain manual unless their config paths can be handled safely.

Manual fallback:

```bash
grape mcp --print-config
```

Typical stdio MCP entry:

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

The auto-install commands are separate from the 1.0.0-beta.7 MCP stdio framing fix. Beta.7 made `grape mcp --stdio` connect correctly; it did not write Cursor or Claude Desktop config files.

What this does:

- The MCP client starts `grape mcp --stdio --repo <repo-root>`.
- The client and Grape exchange one JSON-RPC object per line over stdio.
- The agent calls `grape_get_context` to get task-specific context.
- Grape tracks what that same session already received.
- Later calls send only new, changed, pinned, invalidated, or restorable context.

Do not configure `Content-Length` framing. MCP stdio uses newline-delimited JSON messages.

Primary tool: `grape_get_context`. See [`mcp-tools.md`](mcp-tools.md) for the full tool reference.

Copy-ready instruction for the agent:

```text
At the start of each repo task turn, call grape_get_context with a stable sessionId and the current task. Treat INVALIDATE_PREVIOUS entries as stale and unsafe. If context is omitted, restore it by token only when needed. For security, auth, payments, data deletion, or deployment tasks, rely on exact proof-backed excerpts rather than summaries.
```

Quick checks if a client does not connect:

- Run `grape --version` in the same shell or environment the client uses.
- For Cursor, confirm `.cursor/mcp.json` contains `mcpServers.grape`.
- For Claude Desktop, confirm `claude_desktop_config.json` contains `mcpServers.grape`.
- Confirm `grape mcp --print-config` points at the intended repo.
- Confirm `cwd` and `--repo` are the same repository root.
- Confirm the client sends one JSON-RPC object per line over stdio.
- Confirm no wrapper script prints banners, logs, or prompts to stdout.
- Run `grape doctor` and `grape doctor --privacy` from the repository root.

Grape's automated packaged beta trial verifies installed CLI and stdio MCP behavior. A specific editor UI is verified only when a human client trial records it.

## Normal agent loop

On each turn, the agent calls `grape_get_context` with:

- `query`: the current task text (keep wording stable for continued turns)
- `sessionId`: a stable ID for this agent session, or `agentName` plus `agentSessionId`
- `outputMode`: `agent_pack` (default) for compact transport deltas

Read `NEW` and `PINNED` items first. Handle `OMIT_UNCHANGED`, `RESTORE_AVAILABLE`, and `INVALIDATE_PREVIOUS` before trusting prior context.

Session rules and recovery paths: [`agent-sessions.md`](agent-sessions.md).

Reset a session only when the agent lost prior context for the same task. Start a new session when the task changes.

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

## What happens on the second turn

On the first turn, Grape sends the context needed for the task and records what the agent saw.

On later turns in the same session, Grape sends only what is new, changed, pinned, stale, or restorable. If a file, rule, dependency, branch, or worktree state changes, Grape tells the agent which previous context must stop being trusted.

- `OMIT_UNCHANGED` means this exact session already received unchanged, safe-to-omit context.
- `RESTORE_AVAILABLE` gives the agent a token to fetch omitted context only if needed.
- `INVALIDATE_PREVIOUS` means prior context is stale and unsafe to keep using.
- high-risk tasks require exact source, config, or rule evidence instead of summaries.

## What Grape stores locally

Grape stores local runtime state under `.grape/`:

- `.grape/config.json` for project setup
- `.grape/grape.db` for SQLite state, sessions, ledgers, proofs, source metadata, and scan diagnostics
- `.grape/artifacts/` for generated JSON and Markdown context artifacts
- restore metadata for omitted context
- proof and excerpt metadata for exact source or rule spans
- observed command and test evidence from `grape run` and `grape test`, stored as hashes and metadata instead of raw stdout or stderr bodies

Grape does not send repository content, artifacts, proofs, summaries, embeddings, or telemetry to a remote Grape service by default. Your MCP client or coding agent may still forward returned context to its model provider.

Manual cleanup while `grape purge` is deferred:

```bash
rm -rf .grape
grape init --connect
```

This removes local Grape state for that repository. It does not change source files or Git history.

## Common errors

| Symptom | What to do |
|---|---|
| `No Git repository found.` | Run Grape from a Git worktree, or pass `--repo <repo-root>`. |
| `This Git repository has no commits yet.` | Create an initial commit, then rerun `grape init --connect`. |
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
