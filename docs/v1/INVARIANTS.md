# V1 Invariants

## Purpose

List the non-negotiable rules that keep Grape safe and coherent.

## Required Contents

Each invariant must include:

- why it exists
- where it is enforced
- what breaks if violated
- required tests

## Readers

All implementers and AI agents.

## Update Triggers

- a new safety or correctness rule is introduced
- enforcement location changes
- a test gap is discovered

## Agent Checks

Before editing code, agents must identify which invariants the change touches.

## Core Invariants

| Invariant | Why it exists | Enforcement | Required tests |
|---|---|---|---|
| No proof means no durable claim. | Prevent fake memory. | Trust Kernel. | no-proof rejection. |
| Summary is never proof. | Keep compression non-authoritative. | Proof validator. | summary-as-proof blocked. |
| Compression is cache, not truth. | Preserve correctness over token savings. | Compression and compiler. | compression cannot promote claims. |
| Context diff is session-scoped. | Prevent cross-agent contamination. | Session and diff modules. | parallel sessions. |
| Branch-invalid claims are not active context. | Prevent stale branch facts. | Scope and current-valid retrieval. | branch switch fixture. |
| Dirty worktree claims are not branch-global. | Prevent temporary local state from becoming durable. | Repo/worktree scope. | dirty worktree fixture. |
| Current-valid is a safety filter, not relevance. | Prevent ranking stale facts. | Retrieval. | filter-before-rank tests. |
| High-risk tasks require exact code/config/rule spans. | Prevent unsafe summary-only context. | Compiler policies. | risk overlay tests. |
| Ignored/private files are not indexed without approval. | Preserve privacy. | Security and evidence modules. | ignored file fixture. |
| Secret excerpts are redacted or blocked. | Prevent leaks. | Security and artifact scan. | secret fixture. |
| Stale proof hash invalidates dependent claims and artifacts. | Prevent stale truth. | Invalidation engine. | stale proof fixture. |
| MCP cannot directly promote durable truth. | Prevent agent abuse. | MCP app service and Trust Kernel. | MCP write contract tests. |
| Every context artifact has a dependency manifest. | Enable invalidation. | Compiler. | artifact golden tests. |
| Every omitted item has restore metadata if restorable. | Avoid silent context loss. | Diff engine. | restore tests. |
| Every new state transition has tests. | Prevent state drift. | State module. | transition tests. |
| Every schema change has migration and docs. | Prevent storage drift. | Storage module. | migration tests. |
| Every compiler policy has tests. | Prevent unsafe pruning. | Compiler. | policy tests. |
| Every compression artifact has input hashes and invalidation tests. | Prevent stale cache. | Compression module. | compression invalidation tests. |
