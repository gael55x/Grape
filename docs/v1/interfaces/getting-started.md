# Getting Started with Grape

This guide takes you from install to a coding agent that calls Grape on every turn. It takes about five minutes.

Grape compiles repository context for the current request, remembers what each agent session has already received, and tells the agent when something it read earlier has gone stale. It runs locally and does not send your repository to any Grape service.

## When to use Grape

Grape helps most when an agent works on the same repository across many turns, files, branches, or handoffs. It gives the agent:

- context compiled from the current Git state, with the source and rules it came from
- a diff against what this session already received, so unchanged context is not resent
- explicit invalidation when a file, branch, or dependency changes under an earlier read

For a one-line edit where the agent already has the whole file in view, Grape adds little.

## Requirements

- Node.js 22.13 or newer
- npm
- Git, and a repository with at least one commit

## 1. Install

```bash
npm install -g grape-context
grape --version
```

If the install resolves an older version, clear the npm cache and install again:

```bash
npm cache clean --force
npm install -g grape-context
```

## 2. Initialize a repository

From the repository root:

```bash
grape init --connect
```

This creates local state in `.grape/`, captures the first Git snapshot, and prints the next setup steps. Grape adds `.grape/` to `.git/info/exclude`, so its state never enters Git.

To preview initialization without writing anything, run `grape init --dry-run`.

Check the result:

```bash
grape doctor
grape doctor --privacy
```

`grape doctor --privacy` shows which files Grape can read and which it rejects.

## 3. Connect your coding agent

MCP is the standard way to use Grape. Once connected, the agent calls Grape itself instead of asking you to paste context.

Run the command for the client you use, from the repository root:

| Client | Command | Config written |
| --- | --- | --- |
| Cursor | `grape mcp --install --client cursor` | `.cursor/mcp.json` in the repository |
| Claude Desktop | `grape mcp --install --client claude` | `claude_desktop_config.json`, when Grape can resolve its path safely |
| Codex | `grape mcp --install --client codex` | `.codex/config.toml` in the repository, for trusted projects |
| Any JSON MCP client | `grape mcp --install --client generic --config-path <file>` | The file you name. Without `--config-path`, Grape prints the JSON and writes nothing. |

Then restart or reload the client if it does not pick up the change on its own.

How install behaves:

- `--dry-run` shows the target file and the final config without writing.
- `--config-path <path>` overrides the target file.
- Grape keeps every other MCP server in the file.
- If a different Grape entry already exists, Grape stops unless you pass `--force`, and then replaces only that entry.

### Manual configuration

For any other client, print the server entry and add it yourself:

```bash
grape mcp --print-config
```

A typical entry looks like this:

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

`cwd` and `--repo` must point at the same repository root. The client and Grape exchange one JSON-RPC message per line over stdio; do not configure `Content-Length` framing.

## 4. Tell the agent to use Grape

Print a ready-made block for `AGENTS.md` or your client's rules file:

```bash
grape mcp --print-agents-snippet
```

Review it before you commit it. Grape never edits your rules files itself.

If you prefer a single instruction, use this:

```text
At the start of each turn on a repository task, call grape_get_context with the current request and a stable sessionId. Use one sessionId for the whole conversation. Read NEW, CHANGED, and PINNED items before acting, and treat INVALIDATE_PREVIOUS items as stale. Restore omitted items by restoreId only when needed. For security, auth, payments, data deletion, or deployment work, rely on exact excerpts rather than summaries.
```

## How a session works

1. You give the agent a repository task.
2. The agent calls `grape_get_context` with the request as `query` and a `sessionId`.
3. Grape returns the context for that request, with a diff state on every item.
4. The agent reads the context and works on the task.
5. On the next turn, the agent calls `grape_get_context` again with the same `sessionId`. The request wording can change.

On later turns, Grape sends only what is new, changed, pinned, stale, or restorable:

| State | Meaning |
| --- | --- |
| `NEW` | Context this session has not received. |
| `CHANGED` | A newer version of context the session received earlier. |
| `PINNED` | Project rules and repository state, resent every turn. |
| `OMIT_UNCHANGED` | The session already has this item and it is still current. |
| `RESTORE_AVAILABLE` | An omitted item the agent can fetch by `restoreId` if it no longer has it. |
| `INVALIDATE_PREVIOUS` | Earlier context whose inputs changed. The agent should stop relying on it. |

For security, authentication, payments, data deletion, and deployment tasks, Grape requires exact source, configuration, or rule excerpts rather than summaries.

Use `resetSession: true` only when the agent has lost earlier context, for example after compaction. Start a new `sessionId` when the conversation moves to unrelated work. Session rules and recovery steps are in [Agent sessions](agent-sessions.md).

## Using the CLI

Use the CLI for debugging, scripts, or agents without MCP support.

```bash
grape status
grape compile --task "Explain checkout discount behavior" --session my-session --json
grape diff-context --task "Explain checkout discount behavior" --session my-session --explain
grape run --session my-session -- npm test
grape sessions
grape stale
grape omitted --session my-session
```

- `grape compile` returns the same context an agent receives over MCP.
- `grape diff-context --explain` shows why each item has its diff state, without item bodies.
- `grape run` and `grape test` record a command's result as observed evidence. They need a session created by `grape compile` or MCP first.

All commands and exit codes are in the [CLI reference](cli.md).

## What Grape stores

Everything lives in `.grape/` in your repository:

| Path | Contents |
| --- | --- |
| `.grape/config.json` | Project setup and retention limits. |
| `.grape/grape.db` | SQLite database with sessions, ledgers, proofs, source metadata, and scan diagnostics. |
| `.grape/artifacts/` | Generated JSON and Markdown context artifacts. |

Observed command and test results are stored as hashes and metadata, not as raw output.

Grape sends no repository content, artifacts, proofs, or telemetry to a remote service. Your MCP client may still forward the context Grape returns to its model provider.

### Cleaning up

New configurations keep context artifacts for 30 days or 500 rows, snapshots for 30 days or 200 rows, search and symbol data for 30 days or 250,000 rows, and invalidated records for 14 days or 50,000 rows.

```bash
grape compact            # preview what would be removed
grape compact --confirm  # remove it
```

`grape compact` never deletes source files, source records, claims, or proofs.

To remove all Grape state for this repository:

```bash
grape purge            # preview
grape purge --confirm  # delete .grape/
grape init --connect   # start again
```

`grape purge --confirm` deletes only `.grape/`, after safety checks. It does not touch source files, Git history, or client configuration.

## Troubleshooting

If the client does not connect:

- Run `grape --version` in the same environment the client uses.
- Check the client's config file for an `mcpServers.grape` entry.
- Run `grape mcp --print-config` and confirm it points at the intended repository.
- Confirm `cwd` and `--repo` are the same repository root.
- Make sure no wrapper script prints banners or logs to stdout.
- Run `grape doctor` from the repository root.

Common errors:

| Message | What to do |
| --- | --- |
| `No Git repository found.` | Run Grape inside a Git worktree, or pass `--repo <repo-root>`. |
| `This Git repository has no commits yet.` | Make an initial commit, then run `grape init --connect` again. |
| `Grape config is missing` | Run `grape init --connect` from the repository root. |
| `context session project mismatch` or `repo mismatch` | The session id belongs to another repository. Choose a new `--session` or `sessionId`. |
| Context session not found (`run` or `test`) | Run `grape compile --task "<task>" --session <id>` first, or list sessions with `grape sessions`. |
| Stale context session | Run `grape compile` again for the same session, or start a new one. |
| `benchmark fixture not found` | Use `grape bench --fixture <name>` with a fixture under `tests/fixtures/`, or pass `--fixture-path`. |
| Feature flags not allowlisted | Add the flag names to the scope allowlist in `.grape/config.json`, or omit `--feature-flags`. |

The automated client trial verifies the installed CLI and stdio MCP behavior. A specific editor's interface counts as verified only when a person records a trial in it.

## Contributor setup for the Codex plugin

This applies only when you work on Grape itself. From a Grape source checkout, at the repository root:

```bash
codex plugin marketplace add .
codex plugin add grape@grape-local
```

The plugin in `plugins/grape` exposes `grape mcp --stdio` and a Grape skill, and assumes `grape` is on `PATH`. It ships no hooks. To verify it, run `npm run build` and `npm run codex:check`. Application repositories should use `grape mcp --install --client codex` instead.

## Scope of this release

Grape 1.1 covers local context transport, session continuity, stale-context invalidation, exact excerpts, MCP setup, and private local storage. It does not include cloud memory, embedding search, or hosted multi-user service. The project [README](../../../README.md) lists what is not included yet, and [1.0 readiness](../planning/1-0-readiness.md) records the original release checklist.

## Related documents

- [Agent sessions](agent-sessions.md): session identity and recovery
- [CLI reference](cli.md): commands and exit codes
- [MCP tools](mcp-tools.md): tool inputs and outputs
