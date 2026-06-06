import { createHash } from "node:crypto";

import type { SourceType } from "../../shared/index.js";
import { evaluateDurableClaimPolicy } from "./claim-policy.js";

export interface SourceExcerptClaimSource {
  readonly sourceId: string;
  readonly sourceType: SourceType;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: string;
  readonly trustClass: string;
  readonly privacyStatus: string;
  readonly redactionStatus: string;
}

export interface SourceExcerptClaimProof {
  readonly proofId: string;
  readonly sourceId: string;
  readonly proofType: string;
  readonly sourceHash: string;
  readonly excerptHash: string;
  readonly supportStatus: string;
}

export interface SourceExcerptClaimExcerpt {
  readonly proofId: string;
  readonly sourceId: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: string;
  readonly excerptHash: string;
  readonly startLine: number;
  readonly endLine: number;
}

export interface SourceExcerptClaimScope {
  readonly branch: string;
  readonly commit: string;
  readonly environment?: string;
  readonly worktreeHash: string;
  readonly sourceRef: string;
  readonly sourceId: string;
  readonly sourceScope: string;
  readonly sourceHash: string;
  readonly proofId: string;
  readonly excerptHash: string;
  readonly startLine: number;
  readonly endLine: number;
}

export interface SourceExcerptClaimDraft {
  readonly candidateId: string;
  readonly claimId: string;
  readonly subject: string;
  readonly claimType: "repository_source_excerpt_exists";
  readonly claimText: string;
  readonly scope: SourceExcerptClaimScope;
}

export type SourceExcerptClaimGateResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: string };

export function createSourceExcerptClaimDraft(input: {
  readonly branch: string;
  readonly commit: string;
  readonly environment?: string;
  readonly worktreeHash: string;
  readonly excerpt: SourceExcerptClaimExcerpt;
}): SourceExcerptClaimDraft {
  const claimId = sourceExcerptClaimId(input.excerpt.proofId);
  const scope: SourceExcerptClaimScope = {
    branch: input.branch,
    commit: input.commit,
    ...(input.environment ? { environment: input.environment } : {}),
    worktreeHash: input.worktreeHash,
    sourceRef: input.excerpt.sourceRef,
    sourceId: input.excerpt.sourceId,
    sourceScope: input.excerpt.sourceScope,
    sourceHash: input.excerpt.sourceHash,
    proofId: input.excerpt.proofId,
    excerptHash: input.excerpt.excerptHash,
    startLine: input.excerpt.startLine,
    endLine: input.excerpt.endLine
  };

  return {
    candidateId: `candidate:${stableHash(["source_excerpt", input.excerpt.proofId]).slice(0, 24)}`,
    claimId,
    subject: input.excerpt.sourceRef,
    claimType: "repository_source_excerpt_exists",
    claimText: [
      `Source ${input.excerpt.sourceRef} contains the selected exact excerpt`,
      `at lines ${input.excerpt.startLine}-${input.excerpt.endLine}.`
    ].join(" "),
    scope
  };
}

export function evaluateSourceExcerptClaimGate(input: {
  readonly source: SourceExcerptClaimSource | undefined;
  readonly proof: SourceExcerptClaimProof | undefined;
  readonly excerpt: SourceExcerptClaimExcerpt;
}): SourceExcerptClaimGateResult {
  if (!input.source) return { accepted: false, reason: "source_missing" };
  if (!input.proof) return { accepted: false, reason: "proof_missing" };
  const policy = evaluateDurableClaimPolicy({
    claimType: "repository_source_excerpt_exists",
    claimMeaning: "source_excerpt_exists",
    proofType: input.proof.proofType,
    sourceType: input.source.sourceType,
    supportStatus: input.proof.supportStatus,
    sourceTrustClass: input.source.trustClass,
    sourcePrivacyStatus: input.source.privacyStatus,
    sourceRedactionStatus: input.source.redactionStatus,
    observer: "local_source_reader",
    proofSignalKind: "exact_source"
  });
  if (!policy.accepted) return { accepted: false, reason: policy.reason };
  if (input.proof.sourceId !== input.excerpt.sourceId) return { accepted: false, reason: "proof_source_mismatch" };
  if (input.proof.sourceHash !== input.excerpt.sourceHash) return { accepted: false, reason: "proof_source_hash_mismatch" };
  if (input.proof.excerptHash !== input.excerpt.excerptHash) {
    return { accepted: false, reason: "proof_excerpt_hash_mismatch" };
  }
  return { accepted: true };
}

export function sourceExcerptClaimId(proofId: string): string {
  return `claim:${stableHash(["repository_source_excerpt_exists", proofId]).slice(0, 24)}`;
}

function stableHash(parts: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
