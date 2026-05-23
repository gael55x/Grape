import type { ScopeMatchResult, VerificationStatus } from "../../shared/index.js";

export interface CurrentValidCandidate {
  id: string;
  text: string;
  sourceRefs: string[];
  proofRefs: string[];
  verificationStatus: VerificationStatus;
  scopeResult: ScopeMatchResult;
}

export type CurrentValidRejectionReason =
  | "not_verified"
  | "scope_mismatch"
  | "scope_partial"
  | "scope_unknown";

export interface CurrentValidRejectedCandidate {
  candidate: CurrentValidCandidate;
  reason: CurrentValidRejectionReason;
}

export interface CurrentValidResolution {
  active: CurrentValidCandidate[];
  rejected: CurrentValidRejectedCandidate[];
  warnings: string[];
}

export function resolveCurrentValidCandidates(
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

    active.push(candidate);
  }

  return { active, rejected, warnings };
}
