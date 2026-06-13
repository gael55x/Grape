/**
 * Session transport policy vocabulary for Grape's context diff protocol.
 *
 * Durable persistence and orchestration live elsewhere:
 * - `src/core/storage/session/` — session rows, locks, compile-state updates
 * - `src/core/storage/context-ledger/` — sent, omitted, and pack ledgers
 * - `src/app/local-project/context/compile-session.ts` — session identity enforcement
 * - `src/app/durable-context-build.ts` — durable diff build under session lock
 * - `src/core/diff/` — in-memory diff algorithm
 */

import { diffStates, type DiffState } from "../../shared/contracts.js";

/** Diff states that count as newly sent to the agent for a session ledger row. */
export const sentDiffStates = ["NEW", "CHANGED", "PINNED"] as const satisfies readonly DiffState[];

export type SentDiffState = (typeof sentDiffStates)[number];

/** Reasons Grape may invalidate prior sent context for a session. */
export const sessionInvalidationReasons = [
  "branch_changed",
  "session_reset",
  "dependency_manifest_changed"
] as const;

export type SessionInvalidationReason = (typeof sessionInvalidationReasons)[number];

/** Reasons restore of an omitted item may be rejected as stale. */
export const restoreStaleReasons = [
  "branch_changed",
  "head_commit_changed",
  "worktree_hash_changed",
  "manifest_hash_changed",
  "proof_hash_changed",
  "source_hash_changed"
] as const;

export type RestoreStaleReason = (typeof restoreStaleReasons)[number];

/** Omission reasons persisted for restorable omissions in the current diff path. */
export const restorableOmissionReason = "unchanged_restorable" as const;

/**
 * Stable session identity is required for safe `OMIT_UNCHANGED`.
 * If the MCP client rotates session IDs, Grape must resend rather than unsafe-omit.
 */
export const sessionIdentityRequirement =
  "Reuse the same session identity across turns. Grape only omits context already sent to that session.";

export function assertKnownDiffState(state: string): asserts state is DiffState {
  if (!(diffStates as readonly string[]).includes(state)) {
    throw new Error(`unknown diff state: ${state}`);
  }
}
