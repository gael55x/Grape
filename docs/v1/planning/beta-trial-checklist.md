# Beta Trial Checklist

Use this checklist for human MCP client trials before promoting `grape-context` from alpha to beta.

Automated `npm run beta:client-trial` already proves packaged-install MCP stdio transport, including omission, restore, invalidation, reset, branch change, redaction, and ignored secret-looking file rejection. Run it locally or rely on CI `beta-smoke`. It does not replace this checklist when release policy requires a real Cursor, Claude Code, or equivalent IDE client configuration.

The beta promise is context transport reliability. A passing trial proves install, MCP connection, session identity, diffing, invalidation, restore, reset, and recovery behavior. It does not prove that Grape is a complete durable memory platform.

## Trial Matrix

Run at least these repos before beta:

- clean TypeScript app
- larger real JavaScript/TypeScript repo
- polyglot fallback repo with at least one Python, Java, or Kotlin source file
- monorepo or nested-package repo when available
- dirty worktree repo
- repo with ignored secret-looking files
- macOS local install
- Linux or WSL install when available

## Runtime And Install

- Node.js is `22.13.0` or newer.
- Install command succeeds:

```bash
npm install -g grape-context@0.1.0-alpha.3
```

- `grape help` exits `0`.
- `grape doctor --json` exits `0` or returns clear setup recovery guidance.
- `grape init --connect` creates local `.grape/` state and keeps `.grape/` out of Git status.

## MCP Client Setup

For each client, configure Grape through stdio using the target repository as `--repo` or `cwd`.

- Client can start `grape mcp --stdio`.
- Client receives `initialize` response.
- Client receives `tools/list` with `grape_get_context`, `grape_get_omitted_item`, `grape_get_status`, and inspection tools.
- Client can call `grape_get_status` without leaking absolute local root paths in user-facing output.

## Context Transport Flow

Use one stable `agentSessionId` or `sessionId` for the same task.

- First `grape_get_context` returns `NEW` and `PINNED` context with no unsafe result.
- Second same-task call returns at least one safe `OMIT_UNCHANGED` or `RESTORE_AVAILABLE` item.
- Stable task/session identity is documented in the trial notes.
- Rewording the task produces mismatch recovery or an intentionally distinct session.

## Recovery Scenarios

Run these in each serious trial:

- Restore one omitted item through `grape_get_omitted_item`.
- Edit a previously sent source file and verify stale dependency rejection or `INVALIDATE_PREVIOUS`.
- Switch branches and verify prior branch context is invalidated.
- Call `resetSession: true` and verify prior sent context is invalidated and current context is resent.
- Try a stale restore token after a file edit and verify no stale body is returned.
- In a polyglot repo, verify unsupported or lower-capability languages return safe exact/path/lexical context plus warnings instead of false AST graph confidence.
- In a monorepo, verify task seed files stay scoped to the relevant package/workspace when boundaries are detected, or that Grape reports partial context when they are not.
- Run `grape run --session <id> -- <cmd...>` or `grape test --session <id> -- <cmd...>` after a current context session exists and verify trusted redacted source evidence plus a narrow observed-run result proof/claim are recorded.

## Pass Criteria

A trial passes only if:

- install and MCP startup succeed without local patching
- context calls do not expose absolute root paths or raw secrets
- omission, restore, branch switch, stale source, and reset behavior match the docs
- recovery guidance is actionable when a flow is rejected
- `grape doctor` or `grape_get_status` can explain setup failures
- observed command/test evidence promotes only the narrow observed-run result claim, not broader durable truth

## Fail Criteria

Block beta promotion if any trial shows:

- install failure on supported Node.js
- MCP startup or `tools/list` failure in a target client
- stale file, branch, or dependency context returned as current
- omitted restore returns a stale body
- private, ignored, or secret-looking file contents appear in output
- raw command/stdout/stderr bodies are persisted or emitted by observed-run JSON
- task/session mismatch silently reuses unrelated context
- recovery output is missing for normal setup and mismatch failures

## Beta Exclusions To Confirm

The trial notes must explicitly confirm these are not treated as beta promises:

- broad durable claim types beyond current narrow source-excerpt, project-rule, and observed-run result claims
- broader behavior/correctness/root-cause claims from Grape-observed command/test runs
- generated/candidate rule promotion and nested rule scope resolution
- automatic conflict resolution beyond manual local CLI resolution edges
- embeddings, semantic ranking, complete call graphs, or broad AST-backed language support
- broad Kotlin/Java/Python/etc. graph extraction beyond safe fallback unless a provider and fixture prove it
- complete monorepo impact cones or multi-repo graphs
- runtime behavior correctness from source excerpts alone

## Feedback To Capture

For each trial record:

- repository shape and platform
- client and exact launch config
- Node.js and package version
- first-turn and second-turn context item counts
- recovery scenario results
- warnings and unsafe reasons
- confusing output or missing guidance
- any issue that required manual local repair
