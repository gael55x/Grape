import { createHash } from "node:crypto";

import {
  createSourceExcerptClaimDraft,
  evaluateSourceExcerptClaimGate
} from "../core/claims/index.js";
import type { RepositoryArtifactSourceExcerptInput } from "../core/compiler/index.js";
import { packageRootsBySourceRefFromMetadata } from "../core/scope/index.js";
import type {
  ClaimStorageRepositories,
  ProofRecord,
  ProofStorageRepositories,
  SourceRecord
} from "../core/storage/index.js";

export interface PersistSourceClaimsInput {
  readonly repositories: ClaimStorageRepositories;
  readonly proofRepositories: ProofStorageRepositories;
  readonly sources: readonly SourceRecord[];
  readonly sourceMetadata?: readonly { readonly sourceRef: string; readonly metadataJson: string | undefined }[];
  readonly sourceExcerpts: readonly RepositoryArtifactSourceExcerptInput[];
  readonly branch: string;
  readonly commit: string;
  readonly environment?: string;
  readonly worktreeHash: string;
  readonly now: string;
}

export interface PersistSourceClaimsResult {
  readonly candidatesSeen: number;
  readonly candidatesInserted: number;
  readonly claimsInserted: number;
  readonly rejectedCandidates: readonly { readonly candidateId: string; readonly reason: string }[];
}

export function persistSourceExcerptClaims(input: PersistSourceClaimsInput): PersistSourceClaimsResult {
  const sourcesById = new Map(input.sources.map((source) => [source.sourceId, source]));
  const sourceMetadataByRef = sourceMetadataBySourceRef(input.sourceMetadata ?? []);
  const rejectedCandidates: { candidateId: string; reason: string }[] = [];
  let candidatesInserted = 0;
  let claimsInserted = 0;

  for (const excerpt of input.sourceExcerpts) {
    const draft = createSourceExcerptClaimDraft({
      branch: input.branch,
      commit: input.commit,
      environment: input.environment,
      worktreeHash: input.worktreeHash,
      excerpt,
      sourceMetadataJson: sourceMetadataByRef.get(excerpt.sourceRef)
    });
    const proof = input.proofRepositories.proofs.get(excerpt.proofId);
    const source = sourcesById.get(excerpt.sourceId);
    const gate = evaluateSourceExcerptClaimGate({ source, proof, excerpt });
    const rejectionReason = gate.accepted ? undefined : gate.reason;

    if (input.repositories.claimCandidates.insertOrIgnore({
      candidateId: draft.candidateId,
      sourceId: excerpt.sourceId,
      subject: draft.subject,
      claimType: draft.claimType,
      claimText: draft.claimText,
      scopeJson: JSON.stringify(draft.scope),
      rejectionReason,
      createdAt: input.now
    })) {
      candidatesInserted += 1;
    }

    if (!gate.accepted) {
      rejectedCandidates.push({ candidateId: draft.candidateId, reason: gate.reason });
      continue;
    }

    const scopeJson = JSON.stringify(draft.scope);
    const inserted = input.repositories.claims.insertOrIgnore({
      claimId: draft.claimId,
      subject: draft.subject,
      claimType: draft.claimType,
      claimText: draft.claimText,
      scopeJson,
      scopeHash: sha256(scopeJson),
      verificationStatus: "verified",
      createdAt: input.now,
      updatedAt: input.now
    });
    if (inserted) claimsInserted += 1;
    attachProofToClaim(input.proofRepositories.proofs, proof, draft.claimId);
  }

  return {
    candidatesSeen: input.sourceExcerpts.length,
    candidatesInserted,
    claimsInserted,
    rejectedCandidates
  };
}

function attachProofToClaim(
  proofs: ProofStorageRepositories["proofs"],
  proof: ProofRecord | undefined,
  claimId: string
): void {
  if (!proof) throw new Error("cannot attach missing proof to source excerpt claim");
  if (proof.claimId === claimId) return;
  if (proof.claimId && proof.claimId !== claimId) {
    throw new Error(`proof ${proof.proofId} is already attached to another claim`);
  }
  if (!proofs.attachClaim({ proofId: proof.proofId, claimId })) {
    throw new Error(`proof ${proof.proofId} could not be attached to claim ${claimId}`);
  }
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function sourceMetadataBySourceRef(
  metadata: readonly { readonly sourceRef: string; readonly metadataJson: string | undefined }[]
): ReadonlyMap<string, string> {
  const packageRoots = packageRootsBySourceRefFromMetadata(metadata);
  const result = new Map<string, string>();
  for (const source of metadata) {
    if (packageRoots.has(source.sourceRef) && source.metadataJson) {
      result.set(source.sourceRef, source.metadataJson);
    }
  }
  return result;
}
