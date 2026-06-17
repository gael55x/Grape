# Agent Session Contract

## Purpose

Define how an AI agent, CLI user, or MCP client must identify a Grape context session during the 1.0 beta transport slice.

Grape only saves tokens when it can prove that the current request belongs to the same repository, task, branch/worktree scope, and session ledger as earlier turns. Session identity is therefore part of the safety contract, not a convenience label.

## Integration Rules At A Glance

| If you are... | Do this |
|---|---|
| Setting up Cursor or Claude Desktop | Use `grape mcp --install --client cursor` or `grape mcp --install --client claude`; keep `cwd` plus `--repo` on the same repository root. |
| Setting up another MCP client | Use `grape mcp --print-config` and paste the manual config. |
| Building or debugging stdio transport | Send one compact JSON-RPC object per line. Do not send `Content-Length` headers. |
| Calling `grape_get_context` | Pass a stable `sessionId` and stable `query` for continued turns on the same task. |
| Starting a new task | Use a new `sessionId`, or change the task text intentionally. |
| Continuing after the agent lost context | Keep the same `sessionId` and `query`, then pass `resetSession: true`. |
| Seeing `INVALIDATE_PREVIOUS` | Stop using the prior context item. Ask Grape for current context again if needed. |
| Seeing `RESTORE_AVAILABLE` | Call `grape_get_omitted_item` only when the omitted body is needed. |

## MCP-driven session tracking (what “background” means)

Grape does **not** run as a daemon that observes every agent turn automatically. After MCP setup, **agent-called** session tracking is real: when the agent calls `grape_get_context` each turn with **stable session identity**, Grape maintains durable sent/omitted/restore/invalidation ledgers without manual `grape compile` or `grape diff-context` commands.

- Grape only omits context already sent to the **same session**.
- If the MCP client rotates `sessionId`, Grape must resend rather than `OMIT_UNCHANGED` unsafely.
- Restore is session-bound; restore tokens from one session must not work in another.
- Branch switches, source edits, and dependency manifest changes may emit `INVALIDATE_PREVIOUS` for prior sends.
- Grape does not claim guaranteed background execution or agent enforcement; stale/unknown status from `grape_get_status` is advisory.

## Beta Install Baseline

The beta transport slice requires Node.js 22.13 or newer.

**Published beta package:**

```bash
npm install -g grape-context@beta
grape --version
grape help
grape init --connect
```

If a machine keeps resolving an older package after install, clear the npm cache and reinstall the beta package:

```bash
npm cache clean --force
npm install -g grape-context@beta
```

Run `grape doctor --privacy` after setup to review local storage, ignored paths, and scanner coverage.

After `grape init --connect`, the intended path is a normal MCP-capable coding agent calling `grape_get_context`. Manual CLI commands such as `grape compile`, `grape sessions`, `grape stale`, and `grape omitted` are debugging and fallback surfaces.

## MCP client configuration

Use auto-install first for supported clients:

```bash
grape mcp --install --client cursor
grape mcp --install --client claude
```

Cursor writes project-local `.cursor/mcp.json`. Claude Desktop writes `claude_desktop_config.json` when Grape can resolve the platform path safely. Use `--dry-run` to preview without writing and `--force` only to replace a conflicting existing `mcpServers.grape` entry.

Manual fallback for other MCP clients:

```bash
grape mcp --print-config
```

Minimal stdio example (replace `<repo-root>` with your repository path):

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

The `cwd` and `--repo` path must point at the same repository root. See [`getting-started.md`](getting-started.md) for the full onboarding path and troubleshooting checklist.

Put this JSON in the MCP server configuration for your coding agent or editor. Grape's automated trial verifies stdio JSON-RPC behavior, not every editor's UI placement. Treat client-specific UI steps as verified only when a human client trial records them.

The auto-install commands are separate from the 1.0.0-beta.7 MCP stdio framing fix. Beta.7 made the stdio server connect correctly; it did not write Cursor or Claude Desktop config.

Copy-ready agent instruction:

```text
At the start of each repo task turn, call grape_get_context with a stable sessionId and the current task. Treat INVALIDATE_PREVIOUS entries as stale and unsafe. If context is omitted, restore it by token only when needed. For security, auth, payments, data deletion, or deployment tasks, rely on exact proof-backed excerpts rather than summaries.
```

## Stable Identity Rules

- A Grape session is scoped to one local project, repo, task id, and task type.
- Prefer explicit `sessionId` for beta clients.
- The task id is derived from the exact task text, task type, and risk overlays.
- Reusing an explicit session with different task wording is a task mismatch, not a follow-up turn.
- CLI calls without `--session` derive the session from repo id, branch, and task id; use an explicit `--session` when one logical agent session must continue across a branch switch.
- Reusing a session after a Git branch switch for the same task is allowed, but Grape emits `INVALIDATE_PREVIOUS` for stale branch-scoped context.
- `--reset-session` or `resetSession: true` invalidates active prior sent items and forces a full resend for that session.
- A session ledger from one agent or client cannot justify `OMIT_UNCHANGED` for another agent or client.

Current limitation: Grape does not infer that two differently worded prompts are the same task. Clients should keep a stable task/query string for a continued turn, or use a new session for a new task.

## CLI Contract

Use the same `--task` and `--session` for a continued task:

```bash
grape compile --task "Explain checkout discount behavior and related tests" --session checkout-discount-review --json
grape compile --task "Explain checkout discount behavior and related tests" --session checkout-discount-review --json
```

If `--session` is omitted, Grape derives a session from the repo id, current Git branch, and task id. That is safe for single-branch fallback use, but it will create a different session on another branch. Use an explicit stable `--session` when you expect branch-switch invalidation inside one logical agent session.

If the agent lost prior context but the task is still the same, reset that session:

```bash
grape compile --task "Explain checkout discount behavior and related tests" --session checkout-discount-review --reset-session --json
```

If the task wording changes, create a different session:

```bash
grape compile --task "Plan a safe refactor of checkout discount behavior" --session checkout-discount-refactor --json
```

Reusing a session with a different task fails with a message like:

```text
context session checkout-discount-review task mismatch: reuse the same --task and --task-type, or choose a new --session.
```

The CLI returns exit code `6` for this mismatch. Exit code `2` remains the unsafe compile bucket for cases such as missing high-risk exact context or token budgets below required context.

## MCP Contract

`grape_get_context` requires either an explicit `sessionId` or an `agentSessionId`.

Preferred call shape:

```json
{
  "query": "Explain checkout discount behavior and related tests",
  "sessionId": "checkout-discount-review",
  "files": ["src/checkout/discount.ts"],
  "tests": ["tests/checkout/discount.test.ts"]
}
```

Repeat later turns with the same `query` and `sessionId` when the task is unchanged. If the agent lost context, keep both stable and add:

```json
{
  "query": "Explain checkout discount behavior and related tests",
  "sessionId": "checkout-discount-review",
  "resetSession": true
}
```

Compatibility pattern:

```json
{
  "query": "Explain checkout discount behavior and related tests",
  "agentName": "example-agent",
  "agentSessionId": "agent-thread-123"
}
```

When `sessionId` is omitted, Grape derives the session from `agentName`, `agentSessionId`, and the exact `query`. Changing the query text changes the derived Grape session. That protects diff safety, but it means arbitrary follow-up phrasing will not collapse into the same sent ledger unless the client supplies a stable explicit `sessionId`.

Do not treat `agentSessionId` as a direct alias for `sessionId`. It is compatibility input for deriving a Grape session when a client cannot provide an explicit `sessionId`.

## Stdio Transport

`grape mcp --stdio` follows the MCP stdio transport contract. Each message is one UTF-8 JSON-RPC request, response, or notification on a single line. Messages are delimited by newlines and must not contain embedded newlines:

```text
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"grape_get_context","arguments":{"query":"Explain checkout discount behavior and related tests","sessionId":"checkout-discount-review"}}}
```

Grape writes each response as one compact JSON object followed by `\n` and accepts LF or CRLF line endings on input. The current message-line size guard is 4 MiB. `Content-Length` header framing belongs to other protocols such as LSP and is rejected with a parse error.

## Diff State Meanings

| State | Meaning for the agent |
|---|---|
| `NEW` | New context that must be read for this turn. |
| `CHANGED` | Context previously sent in this session changed and must be reread. |
| `PINNED` | Safety-critical context resent even when unchanged. |
| `OMIT_UNCHANGED` | Grape intentionally omitted unchanged, non-pinned context already sent to this same session. |
| `RESTORE_AVAILABLE` | An omitted item can be restored with the provided token if the agent needs the body again. |
| `INVALIDATE_PREVIOUS` | A prior item sent to this session is stale and must not be used as current context. |

`OMIT_UNCHANGED` never means the context is globally irrelevant. It means this exact session already received the same safe-to-omit item. `RESTORE_AVAILABLE` is a hint to use `grape_get_omitted_item` or `grape omitted --session <id> --token <restoreToken>`. `INVALIDATE_PREVIOUS` takes priority over prior memories or notes.

## Recovery Playbook

| Symptom | Recovery |
|---|---|
| `context session task mismatch` | Reuse the original task text, or choose a new `--session` / `sessionId` for the new task. |
| Agent lost earlier context | Reuse the same task/session and pass `--reset-session` or `resetSession: true`. |
| Second turn sends a full pack unexpectedly | Confirm the exact task/query, task type, risk overlays, branch, and explicit `sessionId` are stable. |
| Restore returns `stale` | Call `grape_get_context` again for current context; do not reuse the old omitted body. |
| Prior context is invalidated | Treat `INVALIDATE_PREVIOUS` entries as higher priority than prior notes, summaries, or chat memory. |
| MCP client hangs or parse fails | Verify the client sends one compact JSON-RPC object per line over stdio, with no `Content-Length` headers and no extra stdout text. |
| Installed CLI appears to be an older package | Run `grape --version`, clear the npm cache if needed, reinstall `grape-context@beta`, and check `grape help` from the active shell path. |

## Related Contracts

- CLI command and exit-code contract: [`cli.md`](cli.md)
- MCP tool schemas and safety rules: [`mcp-tools.md`](mcp-tools.md)
- Context diff wire protocol: [`../contracts/context-diff.md`](../contracts/context-diff.md)
- Context artifact contract: [`../contracts/context-artifact.md`](../contracts/context-artifact.md)
