---
name: grape
description: "Use Grape MCP for Codex context continuity in coding repositories. Use when a task needs repeated-turn context, omitted context restore, stale-context checks, invalidation checks, or safe continuity across branch and dirty-worktree changes."
---

# Grape

Use this skill when Grape MCP tools are available in a coding repository.

Grape is the context continuity and safety layer for coding agents. It is not a code graph replacement. Use code search, language servers, and graph tools to find code. Use Grape to ask what the agent has already seen, what changed, what can be omitted, what can be restored, what remains trusted, and what must be invalidated.

At the start of a coding task, call `grape_get_context` with the current task and a stable `sessionId`. Reuse the same `sessionId` and task wording for follow-up turns on the same task.

Read `NEW`, `CHANGED`, and `PINNED` context before editing. Treat `INVALIDATE_PREVIOUS` as stale context that must not be reused. Use `grape_get_omitted_item` only when a `RESTORE_AVAILABLE` body is needed.

If the user switches branches, rebases, merges, or changes files outside your edits, call `grape_get_context` again before relying on prior context. If Grape reports incomplete or unsafe context, say what is missing and inspect the repository directly before making claims.

Do not promote model-inferred facts to durable memory through MCP write tools. Prefer Grape-observed CLI commands such as `grape run --session <id> -- <cmd...>` or `grape test --session <id> -- <cmd...>` when command or test evidence should become trusted local evidence.

Use `resetSession` only when prior agent context was lost or the current conversation cannot safely map to the previous session.
