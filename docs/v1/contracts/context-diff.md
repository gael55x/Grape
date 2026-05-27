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
  taskId?: string;
  artifactId: string;
  sectionId: string;
  itemKind: ContextPackItem["itemKind"];
  itemRef: string;
  itemHash: string;
  branchName: string;
  commitSha: string;
  dependencyManifestHash: string;
  wasPinned: boolean;
  lastDiffState: DiffState;
  omitReason?: string;
  restoreHint?: string;
  sessionResetId?: string;
  firstSentAt: string;
  lastSentAt: string;
  sendCount: number;
  tokenCount: number;
}

interface OmittedContextItem {
  omittedItemId: string;
  sessionId: string;
  artifactId: string;
  sectionId: string;
  itemKind: ContextPackItem["itemKind"];
  itemRef: string;
  itemHash: string;
  contentHash: string;
  branchName: string;
  commitSha: string;
  dependencyManifestHash: string;
  lastDiffState: DiffState;
  reasonOmitted: "unchanged_restorable" | "not_relevant" | "unsafe_to_send" | "blocked_by_policy";
  canRestore: boolean;
  restoreId?: string;
  restoreCommand?: string;
  omittedAt: string;
  sendCount: number;
  tokenCount: number;
}
```

## Diff Rules

- Diffing is session-scoped. A sent ledger from one session cannot be used by another session.
- Unknown, reset, expired, or corrupted sessions force full resend of required context.
- `PINNED` context is resent when safety-critical, when policy requires it, or when the session was reset.
- `OMIT_UNCHANGED` is allowed only for unchanged, non-pinned items with a safe omission reason.
- `RESTORE_AVAILABLE` requires a restore token that can retrieve the omitted item from local storage.
- When `canRestore` is true, `restoreId` and `restoreCommand` are required.
- Stored sent, omitted, and pack items must reference an artifact owned by the same session.
- `INVALIDATE_PREVIOUS` must include the prior item ID or prior section ID being invalidated.
- A branch, worktree, dependency, or compression invalidation must invalidate sent items that relied on it.
- A stale sent item should emit `INVALIDATE_PREVIOUS` once per session. Later packs should not repeat the same invalidation after it has already been recorded in the session pack ledger, and invalidated sent rows must not be reused as current context if a later artifact returns to the same dependency manifest.

## In-Memory Loop Proof

The current implementation goal proves only the in-memory part of the diff contract:

- first turn emits `NEW` for ordinary sections and `PINNED` for pinned sections
- second no-change turn emits `OMIT_UNCHANGED` only for unchanged, non-pinned sections
- every in-memory omission includes `safeOmissionReason: "unchanged_restorable"` and a restore token
- `RESTORE_AVAILABLE` is emitted for omitted restorable sections
- previous sent items are matched only when `sessionId` matches
- pinned sections are resent instead of omitted
- unsafe omission count must stay zero

The in-memory loop only proves restore metadata shape. The current product slice adds restore lookup for persisted scaffold artifacts through CLI and MCP. Explicit session reuse across a branch switch now updates the session's compile state, records a `session_invalidated` event with `reason: "branch_changed"`, and emits `INVALIDATE_PREVIOUS` for stale prior sent items instead of omitting them. Explicit session reset through CLI `--reset-session` or MCP `resetSession: true` records a `session_invalidated` event with `reason: "session_reset"`, invalidates active prior sent items once, and forces current sections to be resent.

## Durable Build Proof

The current persisted build proof adds a narrow app-level build service:

- it accepts an already-built context artifact
- it renews or acquires the session lock
- it persists the artifact dependency manifest
- it compares against the same-session sent ledger
- it can ignore the same-session sent ledger after an explicit reset and invalidate active prior sent items
- it persists structured context pack items
- it persists sent and omitted ledger rows
- it emits `INVALIDATE_PREVIOUS` for stale dependency manifests
- it updates existing session compile state under the session lock and records branch-change invalidation events when the same session moves branches
- it commits or rolls back the build as one storage transaction

This proof does not perform MCP transport, CLI rendering, broad repository indexing, trust extraction, or compression.

Current implementation note: the durable diff service still uses scaffold in-memory diff rows internally for comparison and ledger persistence, then maps them to V1-shaped `ContextPackItem` outputs at the compiler/app boundary. Public CLI, artifact JSON, and MCP context responses expose `content`, `restoreId`, `inputRefs`, `itemKind`, and safety fields rather than the internal scaffold row shape.

After a durable pack is persisted, local compile builds a deterministic `context_pack_summary` compression artifact from the latest active, non-compression sent rows for the current branch/head. Already-invalidated sent rows, compression-orientation rows, and rows from another branch/head are excluded so the summary cannot recursively summarize itself or revive stale context. The summary is cached but not yet rendered into artifacts because artifact-level manifest invalidation would otherwise mark no-change turns stale.

`grape stale` is the current CLI-first inspection surface for persisted invalidation rows. It reads `INVALIDATE_PREVIOUS` pack items from the session-scoped ledger, reports the prior sent item IDs they invalidate, and classifies the emitted invalidation as `branch_changed`, `session_reset`, or `dependency_manifest_changed` from same-artifact session events. It intentionally does not predict future stale rows before the compiler/diff engine has emitted them.

## Restore Protocol

1. Diff engine omits an unchanged item only after writing an `OmittedContextItem`.
2. MCP or CLI returns `RESTORE_AVAILABLE` with `restoreToken` when applicable.
3. `grape omitted --session <id>` lists omitted rows for a session.
4. `grape omitted --session <id> --token <restoreToken>` and `grape_get_omitted_item` validate session ID, token, stored artifact identity, artifact hash, stored dependency rows, section content hash, dependency manifest, branch, head commit, worktree hash, source/config/lockfile/rule dependency hashes, proof dependency rows/hashes, and redaction status.
5. If dependencies changed, restore returns stale metadata instead of stale content.

## Required Tests

- `diff_is_session_scoped`
- `unknown_session_forces_full_resend`
- `agent_session_reset_forces_full_resend`
- `pinned_context_is_resent`
- `omit_unchanged_requires_restore_or_safe_reason`
- `cross_session_artifact_ledger_rows_fail_closed`
- `restorable_omission_requires_restore_metadata`
- `restore_token_rejects_stale_dependency`
- `invalidate_previous_names_prior_item`
- `branch_switch_invalidates_sent_items`
- `compression_invalidation_invalidates_sent_items`
- `durable_context_build_persists_first_turn_pack`
- `durable_context_build_omits_second_turn_unchanged_context`
- `durable_context_build_invalidates_stale_manifest`
- `durable_context_build_rolls_back_partial_state`
