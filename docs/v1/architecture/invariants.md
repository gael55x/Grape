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

| ID | Invariant | Why it exists | Enforcement | What breaks if violated | Required tests |
|---|---|---|---|---|---|
| `INV-TRUST-001` | No proof means no durable claim. | Prevent fake memory. | Trust Kernel. | Grape starts persisting plausible but unproven agent/model claims. | `no_proof_rejects_durable_claim` |
| `INV-TRUST-002` | Summary is never proof. | Keep compression non-authoritative. | Proof validator. | A stale or lossy summary can become durable truth. | `summary_as_proof_rejected` |
| `INV-COMP-001` | Compression is cache, not truth. | Preserve correctness over token savings. | Compression and compiler. | Token savings can hide missing or stale evidence. | `compression_artifact_never_valid_proof` |
| `INV-DIFF-001` | Context diff is session-scoped. | Prevent cross-agent contamination. | Session and diff modules. | One agent may omit context because another agent saw it. | `diff_is_session_scoped`, `parallel_sessions_isolated` |
| `INV-SCOPE-001` | Branch-invalid claims are not active context. | Prevent stale branch facts. | Scope and current-valid retrieval. | Context from another branch can guide current work. | `branch_invalid_claim_excluded` |
| `INV-SCOPE-002` | Dirty worktree claims are not branch-global. | Prevent temporary local state from becoming durable. | Repo/worktree scope. | Local uncommitted changes become false branch truth. | `dirty_worktree_claim_not_branch_global` |
| `INV-RETR-001` | Current-valid is a safety filter, not relevance. | Prevent ranking stale facts. | Retrieval. | Stale or mismatched facts can rank highly and be sent. | `current_valid_filters_before_ranking` |
| `INV-RISK-001` | Security, auth, permissions, payments, webhooks, secrets, crypto, migration, and production-config tasks require exact code/config/rule spans. | Prevent unsafe summary-only context. | Compiler policies. | High-risk tasks can proceed from lossy summaries. | `high_risk_overlay_forbids_summary_replacement` |
| `INV-SEC-001` | Ignored/private files are not indexed without approval. | Preserve privacy. | Security and evidence modules. | Private files leak into indexes, proofs, artifacts, or logs. | `ignored_file_not_indexed_without_approval` |
| `INV-SEC-002` | Secret excerpts are redacted or blocked. | Prevent leaks. | Security and artifact scan. | Raw secrets persist in local artifacts, logs, or examples. | `raw_env_value_not_in_artifact` |
| `INV-INVAL-001` | Stale proof hash invalidates dependent claims and artifacts. | Prevent stale truth. | Invalidation engine. | Changed source continues proving old claims. | `stale_proof_hash_invalidates_claim_and_artifact` |
| `INV-MCP-001` | MCP cannot directly promote durable truth. | Prevent agent abuse. | MCP app service and Trust Kernel. | Agent-supplied writes bypass verification. | `mcp_write_tool_cannot_promote_claim` |
| `INV-ART-001` | Every context artifact has a dependency manifest. | Enable invalidation. | Compiler. | Artifacts cannot be proven current or invalidated. | `context_artifact_requires_dependency_manifest` |
| `INV-DIFF-002` | Every omitted item has restore metadata if restorable. | Avoid silent context loss. | Diff engine. | Agents cannot recover omitted context safely. | `omit_unchanged_requires_restore_or_safe_reason` |
| `INV-STATE-001` | Every new state transition has tests. | Prevent state drift. | State module. | Hidden side effects bypass trust and invalidation. | `transition_matrix_covers_state_event` |
| `INV-STOR-001` | Every schema change has migration and docs. | Prevent storage drift. | Storage module. | Existing local databases break or silently corrupt data. | `migration_applies_from_previous_schema` |
| `INV-COMPILER-001` | Every compiler policy has tests. | Prevent unsafe pruning. | Compiler. | The compiler may omit required proof, rules, warnings, or exact spans. | `compiler_policy_golden_tests` |
| `INV-COMP-002` | Every compression artifact has input hashes and invalidation tests. | Prevent stale cache. | Compression module. | Stale compression can be reused as current orientation. | `compression_artifact_requires_input_hashes` |

## Enforcement Rule

If a change touches an invariant but does not update the relevant tests, the change is incomplete. If an invariant needs to be weakened, create an ADR and update `../planning/spec-changelog.md` before implementation.
