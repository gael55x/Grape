# agentmemory comparator

- **Package:** npm `@agentmemory/agentmemory`, `@agentmemory/mcp`
- **Benchmark decision:** `benchmark partially`
- **Comparison class:** `session-recall`

## Comparable dimensions

- Coding-agent MCP server
- Session-2 injected context size
- Local SQLite default storage

## Not applicable

- Proof-backed current-valid filtering
- Branch/worktree invalidation
- `INVALIDATE_PREVIOUS` / restore tokens

## Setup (manual)

```bash
npm install -g @agentmemory/agentmemory
# start server per upstream docs; configure MCP in client
```

Skipped in default `bench:comparators` when server not installed.
