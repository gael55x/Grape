# V1 Context Diff

## Purpose

Define the session-scoped context delta protocol.

## Source Of Truth

This document derives from the diff and session contract in `docs/v1/SPEC.md`.

## Update Triggers

- diff state changes
- sent-item schema changes
- restore behavior changes
- session reset or branch switch behavior changes

## Agent Checks

Before editing diff behavior, agents must verify:

- diff is session-scoped
- pinned safety context is resent when required
- omitted items have safe reasons and restore metadata when restorable
- stale previous context emits `INVALIDATE_PREVIOUS`

## Canonical Diff States

```text
NEW
CHANGED
PINNED
OMIT_UNCHANGED
INVALIDATE_PREVIOUS
RESTORE_AVAILABLE
```

## Canonical Ledgers

```ts
interface ContextSentItem {
  sentItemId: string;
  sessionId: string;
  artifactId: string;
  sectionId: string;
  contentHash: string;
  diffState: DiffState;
  dependencyManifestHash: string;
  pinned: boolean;
  sentAt: string;
}

interface OmittedContextItem {
  omittedItemId: string;
  sessionId: string;
  artifactId: string;
  sectionId: string;
  contentHash: string;
  reason: "unchanged" | "not_relevant" | "unsafe_to_send" | "blocked_by_policy";
  restoreAvailable: boolean;
  restoreToken?: string;
  omittedAt: string;
}
```

## Diff Rules

- Diffing is session-scoped. A sent ledger from one session cannot be used by another session.
- Unknown, reset, expired, or corrupted sessions force full resend of required context.
- `PINNED` context is resent when safety-critical, when policy requires it, or when the session was reset.
- `OMIT_UNCHANGED` is allowed only for unchanged, non-pinned items with a safe omission reason.
- `RESTORE_AVAILABLE` requires a restore token that can retrieve the omitted item from local storage.
- `INVALIDATE_PREVIOUS` must include the prior item ID or prior section ID being invalidated.
- A branch, worktree, dependency, or compression invalidation must invalidate sent items that relied on it.

## In-Memory Loop Proof

The current implementation goal proves only the in-memory part of the diff contract:

- first turn emits `NEW` for ordinary sections and `PINNED` for pinned sections
- second no-change turn emits `OMIT_UNCHANGED` only for unchanged, non-pinned sections
- every in-memory omission includes `safeOmissionReason: "unchanged_restorable"` and a restore token
- `RESTORE_AVAILABLE` is emitted for omitted restorable sections
- previous sent items are matched only when `sessionId` matches
- pinned sections are resent instead of omitted
- unsafe omission count must stay zero

Durable ledgers, restore lookup, branch invalidation, and cross-process session locks belong to the later Alpha Product Slice.

## Restore Protocol

1. Diff engine omits an unchanged item only after writing an `OmittedContextItem`.
2. MCP or CLI returns `RESTORE_AVAILABLE` with `restoreToken` when applicable.
3. `grape_get_omitted_item` validates session ID, token, artifact hash, dependency manifest, and redaction status.
4. If dependencies changed, restore returns an invalidation instead of stale content.

## Required Tests

- `diff_is_session_scoped`
- `unknown_session_forces_full_resend`
- `pinned_context_is_resent`
- `omit_unchanged_requires_restore_or_safe_reason`
- `restore_token_rejects_stale_dependency`
- `invalidate_previous_names_prior_item`
- `branch_switch_invalidates_sent_items`
- `compression_invalidation_invalidates_sent_items`
