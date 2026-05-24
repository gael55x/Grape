import type { NonEmptyArray, ScopeMatchResult, VerificationStatus } from "../../shared/index.js";

export type HashGateStatus = "match" | "mismatch" | "unknown";
export type ContradictionStatus = "none" | "active";
export type PrivacyGateStatus = "allowed" | "blocked";
export type DirtyScopeStatus = "not_dirty" | "match" | "mismatch" | "unknown";

export interface CurrentValidCandidate {
  id: string;
  text: string;
  sourceRefs: string[];
  proofRefs: NonEmptyArray<string>;
  verificationStatus: VerificationStatus;
  scopeResult: ScopeMatchResult;
  sourceHashStatus: HashGateStatus;
  proofHashStatus: HashGateStatus;
  contradictionStatus: ContradictionStatus;
  privacyStatus: PrivacyGateStatus;
  dirtyScopeStatus: DirtyScopeStatus;
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

export function resolveInMemoryCurrentValidCandidates(
  candidates: readonly CurrentValidCandidate[]
): CurrentValidResolution {
  const active: CurrentValidCandidate[] = [];
  const rejected: CurrentValidRejectedCandidate[] = [];
  const warnings: string[] = [];

  for (const candidate of candidates) {
    if (candidate.verificationStatus !== "verified") {
      rejected.push({ candidate, reason: "not_verified" });
      continue;
    }

    if (candidate.proofRefs.length === 0) {
      rejected.push({ candidate, reason: "missing_proof" });
      continue;
    }

    if (candidate.sourceHashStatus === "mismatch") {
      rejected.push({ candidate, reason: "source_hash_mismatch" });
      continue;
    }

    if (candidate.proofHashStatus === "mismatch") {
      rejected.push({ candidate, reason: "proof_hash_mismatch" });
      continue;
    }

    if (candidate.sourceHashStatus === "unknown" || candidate.proofHashStatus === "unknown") {
      rejected.push({ candidate, reason: "hash_unknown" });
      warnings.push(`Hash status is unknown, not current-valid: ${candidate.id}`);
      continue;
    }

    if (candidate.contradictionStatus === "active") {
      rejected.push({ candidate, reason: "active_contradiction" });
      continue;
    }

    if (candidate.privacyStatus === "blocked") {
      rejected.push({ candidate, reason: "privacy_blocked" });
      continue;
    }

    if (candidate.dirtyScopeStatus === "mismatch") {
      rejected.push({ candidate, reason: "dirty_scope_mismatch" });
      continue;
    }

    if (candidate.dirtyScopeStatus === "unknown") {
      rejected.push({ candidate, reason: "dirty_scope_unknown" });
      warnings.push(`Dirty worktree scope is unknown, not current-valid: ${candidate.id}`);
      continue;
    }

    if (candidate.scopeResult === "match") {
      active.push(candidate);
      continue;
    }

    if (candidate.scopeResult === "mismatch") {
      rejected.push({ candidate, reason: "scope_mismatch" });
      continue;
    }

    if (candidate.scopeResult === "partial") {
      rejected.push({ candidate, reason: "scope_partial" });
      warnings.push(`Partial scope is not current-valid: ${candidate.id}`);
      continue;
    }

    if (candidate.scopeResult === "unknown") {
      rejected.push({ candidate, reason: "scope_unknown" });
      warnings.push(`Unknown scope is not current-valid: ${candidate.id}`);
      continue;
    }

    rejected.push({ candidate, reason: "scope_invalid" });
  }

  return { active, rejected, warnings };
}
