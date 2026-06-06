import { createGitRepoSnapshot } from "../../../core/git/index.js";
import {
  claimIdsBlockedByActiveClaimEdges,
  durableClaimPolicyDefaultsForClaimType,
  evaluateDurableClaimPolicy
} from "../../../core/claims/index.js";
import { resolveInMemoryCurrentValidCandidates } from "../../../core/retrieval/index.js";
import type { CurrentValidCandidate } from "../../../core/retrieval/index.js";
import { resolveCurrentClaimScope } from "../../../core/scope/index.js";
import type {
  ClaimRecord,
  ClaimStorageRepositories,
  EvidenceStorageRepositories,
  ProofRecord,
  ProofStorageRepositories,
  SourceRecord
} from "../../../core/storage/index.js";
import type { LocalClaimSummary } from "../types.js";

export interface ResolveLocalCurrentValidClaimsInput {
  readonly claims: ClaimStorageRepositories["claims"];
  readonly claimEdges: ClaimStorageRepositories["claimEdges"];
  readonly proofs: ProofStorageRepositories["proofs"];
  readonly sources: EvidenceStorageRepositories["sources"];
  readonly snapshot: ReturnType<typeof createGitRepoSnapshot>;
  readonly sessionId?: string;
  readonly taskSourceRefs?: readonly string[];
}

export interface ResolveLocalCurrentValidClaimsResult {
  readonly activeClaims: readonly LocalClaimSummary[];
  readonly visibleClaims: readonly LocalClaimSummary[];
  readonly rejectedCount: number;
  readonly warnings: readonly string[];
}

export function resolveLocalCurrentValidClaims(
  input: ResolveLocalCurrentValidClaimsInput
): ResolveLocalCurrentValidClaimsResult {
  const claims = input.claims.list();
  const edgeBlocks = claimIdsBlockedByActiveClaimEdges({
    claims: claims.map(toClaimEdgePolicyClaim),
    edges: input.claimEdges.list()
  });
  const currentFiles = new Map(input.snapshot.files.map((file) => [file.path, file.sha256]));
  const resolved = resolveInMemoryCurrentValidCandidates(
    claims.map((claim) =>
      toCurrentValidCandidate({
        claim,
        proofs: input.proofs.listByClaim(claim.claimId),
        sourceForProof: (proof) => input.sources.get(proof.sourceId),
        currentFiles,
        snapshot: input.snapshot,
        activeContradictionClaimIds: edgeBlocks.blockedClaimIds
      })
    )
  );
  const activeIds = new Set(resolved.active.map((claim) => claim.id));
  const allActiveClaims = claims
    .filter((claim) => activeIds.has(claim.claimId))
    .map((claim) => toClaimSummary(claim, input.proofs.listByClaim(claim.claimId)));

  return {
    activeClaims: selectTaskScopedClaims(allActiveClaims, input.taskSourceRefs, input.sessionId),
    visibleClaims: claims.map((claim) => toClaimSummary(claim, input.proofs.listByClaim(claim.claimId))),
    rejectedCount: resolved.rejected.length,
    warnings: [...resolved.warnings, ...edgeBlocks.warnings]
  };
}

function selectTaskScopedClaims(
  claims: readonly LocalClaimSummary[],
  taskSourceRefs: readonly string[] | undefined,
  sessionId: string | undefined
): readonly LocalClaimSummary[] {
  if (taskSourceRefs === undefined) return claims;

  const taskSourceOrder = new Map(taskSourceRefs.map((sourceRef, index) => [sourceRef, index]));
  return claims
    .filter((claim) =>
      claim.sourceRefs.some((sourceRef) => taskSourceOrder.has(sourceRef)) ||
      isProjectRuleClaim(claim) ||
      isCurrentSessionObservedRunClaim(claim, sessionId)
    )
    .sort(
      (left, right) =>
        claimTaskOrder(left, taskSourceOrder, sessionId) - claimTaskOrder(right, taskSourceOrder, sessionId)
    );
}

function claimTaskOrder(
  claim: LocalClaimSummary,
  taskSourceOrder: ReadonlyMap<string, number>,
  sessionId: string | undefined
): number {
  const positions = claim.sourceRefs
    .map((sourceRef) => taskSourceOrder.get(sourceRef))
    .filter((position): position is number => position !== undefined);
  if (positions.length > 0) return Math.min(...positions);
  if (isProjectRuleClaim(claim)) return Number.MAX_SAFE_INTEGER - 2;
  if (isCurrentSessionObservedRunClaim(claim, sessionId)) return Number.MAX_SAFE_INTEGER - 1;
  return Number.MAX_SAFE_INTEGER;
}

function isProjectRuleClaim(claim: LocalClaimSummary): boolean {
  return claim.claimType === "project_rule";
}

function isCurrentSessionObservedRunClaim(claim: LocalClaimSummary, sessionId: string | undefined): boolean {
  return (
    claim.claimType === "grape_observed_run_result" &&
    typeof claim.scope.sessionId === "string" &&
    claim.scope.sessionId === sessionId
  );
}

function toCurrentValidCandidate(input: {
  readonly claim: ClaimRecord;
  readonly proofs: readonly ProofRecord[];
  readonly sourceForProof: (proof: ProofRecord) => SourceRecord | undefined;
  readonly currentFiles: ReadonlyMap<string, string>;
  readonly snapshot: ReturnType<typeof createGitRepoSnapshot>;
  readonly activeContradictionClaimIds: ReadonlySet<string>;
}): CurrentValidCandidate {
  const scope = parseScope(input.claim.scopeJson);
  const sources = input.proofs.map(input.sourceForProof);
  const scopeResolution = resolveCurrentClaimScope(scope, {
    branch: input.snapshot.branch,
    commit: input.snapshot.commit,
    worktreeHash: input.snapshot.worktreeHash
  });
  return {
    id: input.claim.claimId,
    text: input.claim.claimText,
    sourceRefs: sources.map((source) => source?.sourceRef ?? stringScope(scope, "sourceRef")).filter(Boolean),
    proofRefs: input.proofs.map((proof) => proof.proofId),
    verificationStatus: input.claim.verificationStatus,
    scopeResult: scopeResolution.scopeResult,
    sourceHashStatus: sourceHashesMatch(input.proofs, sources, input.currentFiles, scope),
    proofHashStatus: proofHashesMatch(input.proofs, scope),
    contradictionStatus: input.activeContradictionClaimIds.has(input.claim.claimId) ? "active" : "none",
    privacyStatus: sources.every((source) => source?.privacyStatus === "allowed" && source.redactionStatus !== "blocked")
      ? "allowed"
      : "blocked",
    dirtyScopeStatus: scopeResolution.dirtyScopeStatus,
    claimPolicyStatus: claimPolicyStatus({
      claim: input.claim,
      proofs: input.proofs,
      sources
    })
  };
}

function claimPolicyStatus(input: {
  readonly claim: ClaimRecord;
  readonly proofs: readonly ProofRecord[];
  readonly sources: readonly (SourceRecord | undefined)[];
}): CurrentValidCandidate["claimPolicyStatus"] {
  const defaults = durableClaimPolicyDefaultsForClaimType(input.claim.claimType);
  if (!defaults) return "blocked";
  if (input.proofs.length === 0) return "allowed";

  return input.proofs.every((proof, index) => {
    const source = input.sources[index];
    if (!source) return false;
    return evaluateDurableClaimPolicy({
      claimType: input.claim.claimType,
      claimMeaning: defaults.claimMeaning,
      proofType: proof.proofType,
      sourceType: source.sourceType,
      supportStatus: proof.supportStatus,
      sourceTrustClass: source.trustClass,
      sourcePrivacyStatus: source.privacyStatus,
      sourceRedactionStatus: source.redactionStatus,
      observer: defaults.observer,
      proofSignalKind: defaults.proofSignalKind
    }).accepted;
  })
    ? "allowed"
    : "blocked";
}

function toClaimSummary(claim: ClaimRecord, proofs: readonly ProofRecord[]): LocalClaimSummary {
  const scope = parseScope(claim.scopeJson);
  return {
    claimId: claim.claimId,
    subject: claim.subject,
    claimType: claim.claimType,
    claimText: claim.claimText,
    verificationStatus: claim.verificationStatus,
    scope,
    scopeHash: claim.scopeHash,
    proofRefs: proofs.map((proof) => proof.proofId),
    sourceRefs: [...new Set(proofs.map((proof) => stringScope(scope, "sourceRef") || proof.sourceId))],
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt
  };
}

function toClaimEdgePolicyClaim(claim: ClaimRecord): {
  readonly claimId: string;
  readonly subject: string;
  readonly claimType: string;
  readonly scope: Readonly<Record<string, unknown>>;
} {
  return {
    claimId: claim.claimId,
    subject: claim.subject,
    claimType: claim.claimType,
    scope: parseScope(claim.scopeJson)
  };
}

function sourceHashesMatch(
  proofs: readonly ProofRecord[],
  sources: readonly (SourceRecord | undefined)[],
  currentFiles: ReadonlyMap<string, string>,
  scope: Record<string, unknown>
): CurrentValidCandidate["sourceHashStatus"] {
  if (proofs.length === 0) return "unknown";
  for (let index = 0; index < proofs.length; index += 1) {
    const source = sources[index];
    const proof = proofs[index];
    if (!source) return "mismatch";
    if (source.sourceHash !== proof.sourceHash) return "mismatch";
    if (isObservedRunProof(proof, source)) {
      const scopedSourceHash = stringScope(scope, "sourceHash");
      if (scopedSourceHash && scopedSourceHash !== proof.sourceHash) return "mismatch";
      continue;
    }
    if (currentFiles.get(source.sourceRef) !== proof.sourceHash) return "mismatch";
  }
  return "match";
}

function proofHashesMatch(
  proofs: readonly ProofRecord[],
  scope: Record<string, unknown>
): CurrentValidCandidate["proofHashStatus"] {
  if (proofs.length === 0) return "unknown";
  const expectedExcerptHash = stringScope(scope, "excerptHash");
  const expectedResultHash = stringScope(scope, "resultHash");
  if (!expectedExcerptHash && !expectedResultHash) return "unknown";
  return proofs.every((proof) => {
    const expected = proof.proofType === "grape_observed_run_result"
      ? expectedResultHash
      : expectedExcerptHash;
    return expected.length > 0 && proof.excerptHash === expected;
  })
    ? "match"
    : "mismatch";
}

function parseScope(scopeJson: string): Record<string, unknown> {
  const parsed = JSON.parse(scopeJson) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("claim scope is not an object");
  }
  return parsed as Record<string, unknown>;
}

function stringScope(scope: Record<string, unknown>, key: string): string {
  const value = scope[key];
  return typeof value === "string" ? value : "";
}

function isObservedRunProof(proof: ProofRecord, source: SourceRecord): boolean {
  return (
    proof.proofType === "grape_observed_run_result" &&
    (source.sourceType === "command_run" || source.sourceType === "test_run")
  );
}
