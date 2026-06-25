import type { ScopeMatchResult, VerificationStatus } from "../../shared/index.js";

export type HashGateStatus = "match" | "mismatch" | "unknown";
export type ContradictionStatus = "none" | "active";
export type PrivacyGateStatus = "allowed" | "blocked";
export type DirtyScopeStatus = "not_dirty" | "match" | "mismatch" | "unknown";
export type ClaimPolicyStatus = "allowed" | "blocked";

export interface CurrentValidCandidate {
  id: string;
  text: string;
  sourceRefs: string[];
  proofRefs: string[];
  verificationStatus: VerificationStatus;
  scopeResult: ScopeMatchResult;
  sourceHashStatus: HashGateStatus;
  proofHashStatus: HashGateStatus;
  contradictionStatus: ContradictionStatus;
  privacyStatus: PrivacyGateStatus;
  dirtyScopeStatus: DirtyScopeStatus;
  claimPolicyStatus: ClaimPolicyStatus;
  claimPolicyReason?: string;
}

export type CurrentValidRejectionReason =
  | "not_verified"
  | "missing_proof"
  | "source_hash_mismatch"
  | "proof_hash_mismatch"
  | "hash_unknown"
  | "active_contradiction"
  | "privacy_blocked"
  | "dirty_scope_mismatch"
  | "dirty_scope_unknown"
  | "claim_policy_blocked"
  | "scope_mismatch"
  | "scope_partial"
  | "scope_unknown"
  | "scope_invalid";

export interface CurrentValidRejectedCandidate {
  candidate: CurrentValidCandidate;
  reason: CurrentValidRejectionReason;
}

export interface CurrentValidResolution {
  active: CurrentValidCandidate[];
  rejected: CurrentValidRejectedCandidate[];
  warnings: string[];
}

interface CurrentValidRejectionRule {
  readonly reason: CurrentValidRejectionReason;
  readonly rejects: (candidate: CurrentValidCandidate) => boolean;
  readonly warning?: (candidate: CurrentValidCandidate) => string;
}

const currentValidRejectionRules = [
  {
    reason: "not_verified",
    rejects: (candidate) => candidate.verificationStatus !== "verified"
  },
  {
    reason: "missing_proof",
    rejects: (candidate) => candidate.proofRefs.length === 0
  },
  {
    reason: "source_hash_mismatch",
    rejects: (candidate) => candidate.sourceHashStatus === "mismatch"
  },
  {
    reason: "proof_hash_mismatch",
    rejects: (candidate) => candidate.proofHashStatus === "mismatch"
  },
  {
    reason: "hash_unknown",
    rejects: (candidate) => candidate.sourceHashStatus === "unknown" || candidate.proofHashStatus === "unknown",
    warning: (candidate) => `Hash status is unknown, not current-valid: ${candidate.id}`
  },
  {
    reason: "active_contradiction",
    rejects: (candidate) => candidate.contradictionStatus === "active"
  },
  {
    reason: "privacy_blocked",
    rejects: (candidate) => candidate.privacyStatus === "blocked"
  },
  {
    reason: "dirty_scope_mismatch",
    rejects: (candidate) => candidate.dirtyScopeStatus === "mismatch"
  },
  {
    reason: "dirty_scope_unknown",
    rejects: (candidate) => candidate.dirtyScopeStatus === "unknown",
    warning: (candidate) => `Dirty worktree scope is unknown, not current-valid: ${candidate.id}`
  },
  {
    reason: "claim_policy_blocked",
    rejects: (candidate) => candidate.claimPolicyStatus === "blocked",
    warning: (candidate) => `Durable claim policy blocked current-valid claim: ${candidate.id}`
  },
  {
    reason: "scope_mismatch",
    rejects: (candidate) => candidate.scopeResult === "mismatch"
  },
  {
    reason: "scope_partial",
    rejects: (candidate) => candidate.scopeResult === "partial",
    warning: (candidate) => `Partial scope is not current-valid: ${candidate.id}`
  },
  {
    reason: "scope_unknown",
    rejects: (candidate) => candidate.scopeResult === "unknown",
    warning: (candidate) => `Unknown scope is not current-valid: ${candidate.id}`
  },
  {
    reason: "scope_invalid",
    rejects: (candidate) => !hasCurrentValidScopeMatch(candidate)
  }
] satisfies readonly CurrentValidRejectionRule[];

function hasCurrentValidScopeMatch(candidate: CurrentValidCandidate): boolean {
  return candidate.scopeResult === "match";
}

export function resolveInMemoryCurrentValidCandidates(
  candidates: readonly CurrentValidCandidate[]
): CurrentValidResolution {
  const active: CurrentValidCandidate[] = [];
  const rejected: CurrentValidRejectedCandidate[] = [];
  const warnings: string[] = [];

  for (const candidate of candidates) {
    const rejection = currentValidRejectionRules.find((rule) => rule.rejects(candidate));
    if (rejection) {
      rejected.push({ candidate, reason: rejection.reason });
      if (rejection.warning) warnings.push(rejection.warning(candidate));
      continue;
    }

    active.push(candidate);
  }

  return { active, rejected, warnings };
}
