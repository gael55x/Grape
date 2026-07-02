# 1.0 Readiness Checklist

This checklist is the stable-release gate for Grape 1.0. It does not add product scope. It decides whether the current local context plugin is ready to publish as a boring install-and-connect tool for MCP-capable coding agents.

## 1.0 Scope

1. Repo context scan
2. Context pack generation
3. Change detection and stale-context invalidation
4. Proof-backed source and rule excerpts
5. MCP stdio server
6. Client install helpers for Cursor, Codex, Claude Desktop, and generic JSON MCP clients
7. Privacy and safety filtering
8. Status and debug commands

Excluded from 1.0: cloud sync, broad agent memory, embeddings, complete call graphs, broad language-aware graph extraction, automatic conflict resolution, benchmark superiority claims, and guaranteed behavior in every editor UI without a recorded human client trial.

## Release Gate

Before publishing stable 1.0, run these from the release candidate commit:

```bash
npm ci
npm run check
npm run benchmark:run
npm run beta:client-trial
npm pack --dry-run
```

Also run the smoke commands from the packaged or built CLI:

```bash
grape --version
grape help
grape init --connect
grape mcp --help
grape mcp --install --client cursor --dry-run
grape mcp --install --client codex --dry-run
grape mcp --install --client claude --dry-run
grape mcp --install --client generic --dry-run
```

## Client Readiness

| Client | Automated proof | Human trial before broad claim |
|---|---|---|
| Cursor | Config creation, merge, conflict refusal, dry-run, and packaged install dry-run are tested. | Confirm Cursor UI loads the tool list and can call `grape_get_status`. |
| Codex | Project-local `.codex/config.toml`, local plugin workflow, and isolated Codex config checks are tested. | Confirm the target Codex surface loads either the MCP config or plugin path used for release. |
| Claude Desktop | Platform config resolution, JSON merge, conflict refusal, and dry-run are tested. | Confirm Claude Desktop or Claude Code loads the server and lists Grape tools. |
| Generic MCP | Manual JSON output and explicit JSON config merge are tested. | Confirm each named third-party client uses the expected JSON config shape. |

## Evidence Rules

- Automated checks prove CLI, package, stdio MCP, config writer, storage, privacy, indexing, retrieval, and behavior contracts inside the test harness.
- Human UI trials prove editor-specific loading behavior only for the client and version tested.
- Benchmark fixtures are local fixture evidence. They do not prove production performance or superiority over external tools.
- Do not publish stable 1.0 if generated docs, examples, artifacts, or package contents contain personal paths, usernames, local cache paths, secrets, or private workspace names.

## Current Open Risks

- Real Cursor, Claude Desktop, and Claude Code UI trials are separate from automated dry-runs.
- The script name `beta:check` is historical. It remains the packaged workflow gate until a later cleanup renames scripts without losing CI history.
- Broad non-TypeScript language support is safe fallback, not full graph extraction.
