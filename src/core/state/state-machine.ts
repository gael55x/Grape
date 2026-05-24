export const grapeStates = [
  "uninitialized",
  "initialized",
  "repo_detected",
  "repo_snapshot_created",
  "worktree_clean",
  "worktree_dirty",
  "evidence_collected",
  "source_classified",
  "source_rejected",
  "claim_candidate_created",
  "proof_attached",
  "proof_validated",
  "durable_claim_persisted",
  "claim_rejected_to_scratch",
  "current_valid_context_resolved",
  "compression_cache_used",
  "compression_cache_invalidated",
  "context_artifact_compiled",
  "context_artifact_dirty",
  "context_diff_generated",
  "context_pack_sent",
  "previous_context_invalidated",
  "omitted_context_restorable",
  "session_active",
  "session_invalidated",
  "unsafe_compile",
  "partial_with_risk"
] as const;

export type GrapeState = (typeof grapeStates)[number];

export const stateEvents = [
  "init_project",
  "detect_repo",
  "create_snapshot",
  "classify_worktree",
  "collect_evidence",
  "classify_source",
  "extract_claim_candidate",
  "attach_proof",
  "validate_proof",
  "promote_claim",
  "resolve_current_valid",
  "compile_artifact",
  "activate_session",
  "generate_diff",
  "send_pack",
  "omit_unchanged",
  "invalidate_previous_context",
  "reject_source",
  "reject_candidate",
  "reject_proof",
  "fail_belief_gate",
  "detect_partial_coverage",
  "detect_blocking_risk",
  "invalidate_session"
] as const;

export type StateEvent = (typeof stateEvents)[number];

export interface StateTransition {
  from: GrapeState;
  to: GrapeState;
  event: StateEvent;
}

export const alphaLoopTransitions: StateTransition[] = [
  { from: "uninitialized", to: "initialized", event: "init_project" },
  { from: "initialized", to: "repo_detected", event: "detect_repo" },
  { from: "repo_detected", to: "repo_snapshot_created", event: "create_snapshot" },
  { from: "repo_snapshot_created", to: "worktree_clean", event: "classify_worktree" },
  { from: "worktree_clean", to: "evidence_collected", event: "collect_evidence" },
  { from: "evidence_collected", to: "source_classified", event: "classify_source" },
  {
    from: "source_classified",
    to: "claim_candidate_created",
    event: "extract_claim_candidate"
  },
  { from: "claim_candidate_created", to: "proof_attached", event: "attach_proof" },
  { from: "proof_attached", to: "proof_validated", event: "validate_proof" },
  { from: "proof_validated", to: "durable_claim_persisted", event: "promote_claim" },
  {
    from: "durable_claim_persisted",
    to: "current_valid_context_resolved",
    event: "resolve_current_valid"
  },
  {
    from: "current_valid_context_resolved",
    to: "context_artifact_compiled",
    event: "compile_artifact"
  },
  {
    from: "context_artifact_compiled",
    to: "session_active",
    event: "activate_session"
  },
  {
    from: "session_active",
    to: "context_diff_generated",
    event: "generate_diff"
  },
  { from: "context_diff_generated", to: "context_pack_sent", event: "send_pack" },
  {
    from: "context_diff_generated",
    to: "omitted_context_restorable",
    event: "omit_unchanged"
  },
  {
    from: "context_artifact_dirty",
    to: "previous_context_invalidated",
    event: "invalidate_previous_context"
  }
] as const;
