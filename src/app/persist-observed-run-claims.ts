import {
  createObservedRunClaimDraft,
  evaluateObservedRunClaimGate
} from "../core/claims/index.js";
import {
  createObservedRunProofCandidate,
  extractObservedRunProofMaterial,
  observedRunResultProofType,
  validateObservedRunProof
} from "../core/proofs/index.js";
import type {
  ClaimStorageRepositories,
  ProofRecord,
  ProofStorageRepositories,
  SourceRecord
} from "../core/storage/index.js";
import {
  assertMatchingProof,
  attachProofToClaim,
  insertClaimCandidate,
  insertVerifiedClaim
} from "./persist-claim-records.js";

export interface PersistObservedRunClaimsInput {
  readonly repositories: ClaimStorageRepositories;
  readonly proofRepositories: ProofStorageRepositories;
  readonly source: SourceRecord;
  readonly now: string;
}

export interface PersistObservedRunClaimsResult {
  readonly candidatesSeen: number;
  readonly candidatesInserted: number;
  readonly proofsSeen: number;
  readonly proofsInserted: number;
  readonly claimsInserted: number;
  readonly proofId?: string;
  readonly claimId?: string;
  readonly claimType?: "grape_observed_run_result";
  readonly rejectedProofs: readonly { readonly sourceId: string; readonly reason: string }[];
  readonly rejectedCandidates: readonly { readonly candidateId: string; readonly reason: string }[];
}

export function persistObservedRunResultClaim(
  input: PersistObservedRunClaimsInput
): PersistObservedRunClaimsResult {
  const material = extractObservedRunProofMaterial(input.source);
  if (!material.accepted) {
    return {
      candidatesSeen: 0,
      candidatesInserted: 0,
      proofsSeen: 1,
      proofsInserted: 0,
      claimsInserted: 0,
      rejectedProofs: [{ sourceId: input.source.sourceId, reason: material.rejectionReason }],
      rejectedCandidates: []
    };
  }

  const proofCandidate = createObservedRunProofCandidate(material.material);
  const proofValidation = validateObservedRunProof(proofCandidate, input.source);
  if (!proofValidation.accepted) {
    return {
      candidatesSeen: 0,
      candidatesInserted: 0,
      proofsSeen: 1,
      proofsInserted: 0,
      claimsInserted: 0,
      proofId: proofCandidate.proofId,
      rejectedProofs: [{ sourceId: input.source.sourceId, reason: proofValidation.rejectionReason }],
      rejectedCandidates: []
    };
  }

  const proof = toProofRecord(proofCandidate, input.now);
  const proofsInserted = insertObservedRunProof(input.proofRepositories.proofs, proof) ? 1 : 0;
  const draft = createObservedRunClaimDraft(proofValidation.material);
  const storedProof = input.proofRepositories.proofs.get(proof.proofId);
  const gate = evaluateObservedRunClaimGate({
    source: input.source,
    proof: storedProof,
    material: proofValidation.material
  });
  const rejectionReason = gate.accepted ? undefined : gate.reason;
  const candidatesInserted = insertClaimCandidate({
    repositories: input.repositories,
    draft,
    sourceId: input.source.sourceId,
    rejectionReason,
    now: input.now
  })
    ? 1
    : 0;

  if (!gate.accepted) {
    return {
      candidatesSeen: 1,
      candidatesInserted,
      proofsSeen: 1,
      proofsInserted,
      claimsInserted: 0,
      proofId: proof.proofId,
      claimId: draft.claimId,
      claimType: draft.claimType,
      rejectedProofs: [],
      rejectedCandidates: [{ candidateId: draft.candidateId, reason: gate.reason }]
    };
  }

  const claimsInserted = insertVerifiedClaim({ repositories: input.repositories, draft, now: input.now })
    ? 1
    : 0;
  attachProofToClaim(input.proofRepositories.proofs, storedProof, draft.claimId, "observed run");

  return {
    candidatesSeen: 1,
    candidatesInserted,
    proofsSeen: 1,
    proofsInserted,
    claimsInserted,
    proofId: proof.proofId,
    claimId: draft.claimId,
    claimType: draft.claimType,
    rejectedProofs: [],
    rejectedCandidates: []
  };
}

function toProofRecord(
  candidate: ReturnType<typeof createObservedRunProofCandidate>,
  now: string
): ProofRecord {
  return {
    proofId: candidate.proofId,
    sourceId: candidate.sourceId,
    proofType: observedRunResultProofType,
    sourceHash: candidate.sourceHash,
    excerptHash: candidate.resultHash,
    supportStatus: "direct",
    createdAt: now
  };
}

function insertObservedRunProof(
  proofs: ProofStorageRepositories["proofs"],
  proof: ProofRecord
): boolean {
  if (proofs.insertOrIgnore(proof)) return true;
  assertMatchingProof(proofs.get(proof.proofId), proof, {
    context: "observed run",
    excerptHashLabel: "proof result hash"
  });
  return false;
}
