# Agent Session Contract

## Purpose

Define how an AI agent, CLI user, or MCP client must identify a Grape context session during the alpha.2 transport slice.

Grape only saves tokens when it can prove that the current request belongs to the same repository, task, branch/worktree scope, and session ledger as earlier turns. Session identity is therefore part of the safety contract, not a convenience label.

## Alpha.2 Install Baseline

The published alpha.2 package requires Node.js 22.13 or newer:

```bash
npm install -g grape-context@0.1.0-alpha.2
grape init --connect
```

If a machine keeps resolving stale alpha.1 code after installing alpha.2, clear the npm cache and reinstall the exact alpha.2 package:

```bash
npm cache clean --force
npm install -g grape-context@0.1.0-alpha.2
```

After `grape init --connect`, the intended path is a normal MCP-capable coding agent calling `grape_get_context`. Manual CLI commands such as `grape compile`, `grape sessions`, `grape stale`, and `grape omitted` are debugging and fallback surfaces.

## Stable Identity Rules

- A Grape session is scoped to one local project, repo, task id, and task type.
- The task id is derived from the exact task text, task type, and risk overlays.
- Reusing an explicit session with different task wording is a task mismatch, not a follow-up turn.
- Reusing a session after a Git branch switch for the same task is allowed, but Grape emits `INVALIDATE_PREVIOUS` for stale branch-scoped context.
- `--reset-session` or `resetSession: true` invalidates active prior sent items and forces a full resend for that session.
- A session ledger from one agent or client cannot justify `OMIT_UNCHANGED` for another agent or client.

Current alpha limitation: Grape does not infer that two differently worded prompts are the same task. Clients should keep a stable task/query string for a continued turn, or use a new session for a new task.

## CLI Contract

Use the same `--task` and `--session` for a continued task:

```bash
grape compile --task "Explain checkout discount behavior and related tests" --session checkout-discount-review --json
grape compile --task "Explain checkout discount behavior and related tests" --session checkout-discount-review --json
```

If the agent lost prior context but the task is still the same, reset that session:

```bash
grape compile --task "Explain checkout discount behavior and related tests" --session checkout-discount-review --reset-session --json
```

If the task wording changes, create a different session:

```bash
grape compile --task "Plan a safe refactor of checkout discount behavior" --session checkout-discount-refactor --json
```

Today, reusing a session with a different task fails with a message like:

```text
context session task mismatch; choose a different --session
```

The current CLI exit mapping returns code `4` for this mismatch because it falls through the storage/schema failure bucket. Exit code `2` remains the unsafe compile bucket for cases such as missing high-risk exact context or token budgets below required context. A clearer dedicated task/session mismatch UX is a planned pre-beta improvement; do not depend on a more specific exit code until that behavior lands.

## MCP Contract

`grape_get_context` requires either an explicit `sessionId` or an `agentSessionId`.

Preferred alpha.2 pattern:

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

## JSON-RPC Stdio Framing

`grape mcp --stdio` speaks framed JSON-RPC over stdio. Each request must be sent as UTF-8 JSON preceded by a `Content-Length` header and a blank line:

```text
Content-Length: <byte-length>

{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"grape_get_context","arguments":{"query":"Explain checkout discount behavior and related tests","sessionId":"checkout-discount-review"}}}
```

Use the byte length of the JSON body, not the character count. Grape writes responses with CRLF header separators and accepts CRLF or LF separators on input. The current frame-size guard is 4 MiB.

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
| MCP client hangs or parse fails | Verify `Content-Length` is the UTF-8 byte length and the blank line separates headers from JSON. |
| Installed CLI appears to be alpha.1 | Run `npm cache clean --force`, reinstall `grape-context@0.1.0-alpha.2`, and check `grape help` from the active shell path. |

## Related Contracts

- CLI command and exit-code contract: [`cli.md`](cli.md)
- MCP tool schemas and safety rules: [`mcp-tools.md`](mcp-tools.md)
- Context diff wire protocol: [`../contracts/context-diff.md`](../contracts/context-diff.md)
- Context artifact projection: [`../contracts/context-artifact.md`](../contracts/context-artifact.md)
