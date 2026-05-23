import type { ScopeMatchResult, VerificationStatus } from "../../shared/index.js";

export type NonEmptyArray<T> = readonly [T, ...T[]];

export interface ClaimCandidate {
  candidateId: string;
  text: string;
  sourceRefs: string[];
  createdAt: string;
}

export interface DurableClaim {
  claimId: string;
  text: string;
  sourceRefs: string[];
  proofRefs: NonEmptyArray<string>;
  verificationStatus: Extract<VerificationStatus, "verified">;
  scopeResult: Extract<ScopeMatchResult, "match">;
  persistedAt: string;
}

export interface ClaimPromotionInput {
  candidate: ClaimCandidate;
  proofRefs: NonEmptyArray<string>;
  scopeResult: Extract<ScopeMatchResult, "match">;
  persistedAt: string;
}

export function createDurableClaimShape(input: ClaimPromotionInput): DurableClaim {
  return {
    claimId: `claim:${input.candidate.candidateId}`,
    text: input.candidate.text,
    sourceRefs: input.candidate.sourceRefs,
    proofRefs: input.proofRefs,
    verificationStatus: "verified",
    scopeResult: input.scopeResult,
    persistedAt: input.persistedAt
  };
}
