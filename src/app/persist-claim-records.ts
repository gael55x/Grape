import { createHash } from "node:crypto";

import type {
  ClaimStorageRepositories,
  ProofRecord,
  ProofStorageRepositories
} from "../core/storage/index.js";

export interface PersistableClaimDraft {
  readonly candidateId: string;
  readonly claimId: string;
  readonly subject: string;
  readonly claimType: string;
  readonly claimText: string;
  readonly scope: unknown;
}

export function insertClaimCandidate(input: {
  readonly repositories: ClaimStorageRepositories;
  readonly draft: PersistableClaimDraft;
  readonly sourceId: string;
  readonly rejectionReason?: string;
  readonly now: string;
}): boolean {
  return input.repositories.claimCandidates.insertOrIgnore({
    candidateId: input.draft.candidateId,
    sourceId: input.sourceId,
    subject: input.draft.subject,
    claimType: input.draft.claimType,
    claimText: input.draft.claimText,
    scopeJson: JSON.stringify(input.draft.scope),
    rejectionReason: input.rejectionReason,
    createdAt: input.now
  });
}

export function insertVerifiedClaim(input: {
  readonly repositories: ClaimStorageRepositories;
  readonly draft: PersistableClaimDraft;
  readonly now: string;
}): boolean {
  const scopeJson = JSON.stringify(input.draft.scope);
  return input.repositories.claims.insertOrIgnore({
    claimId: input.draft.claimId,
    subject: input.draft.subject,
    claimType: input.draft.claimType,
    claimText: input.draft.claimText,
    scopeJson,
    scopeHash: sha256(scopeJson),
    verificationStatus: "verified",
    createdAt: input.now,
    updatedAt: input.now
  });
}

export function attachProofToClaim(
  proofs: ProofStorageRepositories["proofs"],
  proof: ProofRecord | undefined,
  claimId: string,
  claimKind: string
): void {
  if (!proof) throw new Error(`cannot attach missing proof to ${claimKind} claim`);
  proofAttachmentHandlers[proofAttachmentRelation(proof, claimId)]({ proofs, proof, claimId });
}

type ProofAttachmentRelation = "claim_match" | "claim_conflict" | "unattached";

interface ProofAttachmentContext {
  readonly proofs: ProofStorageRepositories["proofs"];
  readonly proof: ProofRecord;
  readonly claimId: string;
}

type ProofAttachmentRelationRule = readonly [
  matches: (proof: ProofRecord, claimId: string) => boolean,
  relation: ProofAttachmentRelation
];

const proofAttachmentRelationRules = [
  [(proof, claimId) => proof.claimId === claimId, "claim_match"],
  [(proof) => Boolean(proof.claimId), "claim_conflict"]
] satisfies readonly ProofAttachmentRelationRule[];

const proofAttachmentHandlers: Record<ProofAttachmentRelation, (context: ProofAttachmentContext) => void> = {
  claim_match: () => undefined,
  claim_conflict: ({ proof }) => {
    throw new Error(`proof ${proof.proofId} is already attached to another claim`);
  },
  unattached: ({ proofs, proof, claimId }) => {
    if (!proofs.attachClaim({ proofId: proof.proofId, claimId })) {
      throw new Error(`proof ${proof.proofId} could not be attached to claim ${claimId}`);
    }
  }
};

function proofAttachmentRelation(proof: ProofRecord, claimId: string): ProofAttachmentRelation {
  return proofAttachmentRelationRules.find(([matches]) => matches(proof, claimId))?.[1] ?? "unattached";
}

export function assertMatchingProof(
  existing: ProofRecord | undefined,
  next: ProofRecord,
  input: {
    readonly context: string;
    readonly excerptHashLabel?: string;
  }
): void {
  if (!existing) throw new Error(`proof insert conflict without stored row: ${next.proofId}`);
  assertProofField("proof source", existing.sourceId, next.sourceId, input.context);
  assertProofField("proof type", existing.proofType, next.proofType, input.context);
  assertProofField("proof source hash", existing.sourceHash, next.sourceHash, input.context);
  assertProofField(
    input.excerptHashLabel ?? "proof excerpt hash",
    existing.excerptHash,
    next.excerptHash,
    input.context
  );
  assertProofField("proof support status", existing.supportStatus, next.supportStatus, input.context);
}

function assertProofField(
  label: string,
  existing: string | undefined,
  next: string | undefined,
  context: string
): void {
  if (existing !== next) throw new Error(`${label} mismatch while persisting ${context} proof`);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
