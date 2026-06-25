import { createHash } from "node:crypto";
import {
  createObservedTestFailureRelationClaimDraft,
  evaluateObservedTestFailureRelationClaimGate
} from "../core/claims/index.js";
import type { RepositoryArtifactSourceInput } from "../core/compiler/index.js";
import { buildObservedTestFailureRelation } from "./build-observed-test-failure-relation.js";
import {
  createObservedTestFailureRelationProofCandidate,
  observedTestFailureRelationProofType,
  validateObservedTestFailureRelationProof,
  type ObservedRunProofMaterial
} from "../core/proofs/index.js";
import { readLocalSourceExcerpts } from "./local-project/source-excerpts/read.js";
import { normalizeRepoRelativePath } from "./local-project/observation/path.js";
import {
  assertMatchingProof,
  attachProofToClaim,
  insertClaimCandidate,
  insertVerifiedClaim
} from "./persist-claim-records.js";
import { persistSourceProofs } from "./persist-source-proofs.js";
import type {
  ClaimStorageRepositories,
  EvidenceStorageRepositories,
  IndexingStorageRepositories,
  ProofRecord,
  ProofStorageRepositories,
  SourceRecord
} from "../core/storage/index.js";
import type { ObservedTestFailureManifestPackageRootEvidence } from "../core/proofs/observed-test-failure-relation-types.js";

export interface PersistObservedTestFailureRelationsInput {
  readonly repositories: ClaimStorageRepositories;
  readonly proofRepositories: ProofStorageRepositories;
  readonly evidenceRepositories: EvidenceStorageRepositories;
  readonly indexingRepositories: IndexingStorageRepositories;
  readonly rootPath: string;
  readonly source: SourceRecord;
  readonly material: ObservedRunProofMaterial;
  readonly observedRunClaimId: string;
  readonly observedRunProofId: string;
  readonly failureOutputText: string;
  readonly now: string;
}

export interface PersistObservedTestFailureRelationsResult {
  readonly relationsSeen: number;
  readonly spanProofsInserted: number;
  readonly relationProofsInserted: number;
  readonly claimsInserted: number;
  readonly claimEdgesInserted: number;
  readonly proofId?: string;
  readonly claimId?: string;
  readonly rejectedProofs: readonly { readonly sourceId: string; readonly reason: string }[];
  readonly rejectedCandidates: readonly { readonly candidateId: string; readonly reason: string }[];
}

export function persistObservedTestFailureRelations(
  input: PersistObservedTestFailureRelationsInput
): PersistObservedTestFailureRelationsResult {
  const sources = toArtifactSources(
    input.evidenceRepositories.sources.listBySnapshot(input.material.metadata.snapshotId)
  );
  const built = buildObservedTestFailureRelation({
    material: input.material,
    observedRunClaimId: input.observedRunClaimId,
    observedRunProofId: input.observedRunProofId,
    failureOutputText: input.failureOutputText,
    sources,
    symbolNodes: input.indexingRepositories.symbolNodes
      .listBySnapshot(input.material.metadata.snapshotId)
      .map((node) => ({ symbolId: node.symbolId, path: node.path, metadataJson: node.metadataJson })),
    symbolEdges: input.indexingRepositories.symbolEdges
      .listBySnapshot(input.material.metadata.snapshotId)
      .map((edge) => ({
        edgeId: edge.edgeId,
        edgeType: edge.edgeType,
        fromSymbolId: edge.fromSymbolId,
        toSymbolId: edge.toSymbolId,
        toRef: edge.toRef
      })),
    manifestPackageRoots: manifestPackageRootsFromClaims(input.repositories.claims.list()),
    normalizePath: (candidate) => {
      try {
        return normalizeRepoRelativePath(input.rootPath, candidate, "failure location");
      } catch {
        return undefined;
      }
    },
    readSpanExcerpt: (source, anchorLine) =>
      readLocalSourceExcerpts({
        rootPath: input.rootPath,
        sources: [source],
        sourceAnchors: [
          {
            sourceRef: source.sourceRef,
            reason: "symbol_match",
            label: "observed_failure_anchor",
            startLine: anchorLine,
            endLine: anchorLine
          }
        ]
      })[0]
  });

  if (!built.accepted || !built.relation) {
    return emptyResult(built.rejectionReason);
  }

  const spanProofResult = persistSourceProofs({
    repositories: input.proofRepositories,
    sources: input.evidenceRepositories.sources
      .listBySnapshot(input.material.metadata.snapshotId)
      .filter((source) =>
        (built.spanExcerpts ?? []).some((excerpt) => excerpt.sourceId === source.sourceId)
      ),
    sourceExcerpts: built.spanExcerpts ?? [],
    now: input.now
  });
  if (spanProofResult.rejectedProofs.length > 0) {
    return {
      relationsSeen: 1,
      spanProofsInserted: spanProofResult.proofsInserted,
      relationProofsInserted: 0,
      claimsInserted: 0,
      claimEdgesInserted: 0,
      rejectedProofs: spanProofResult.rejectedProofs.map((rejection) => ({
        sourceId: rejection.sourceId,
        reason: rejection.reason
      })),
      rejectedCandidates: []
    };
  }

  const proofCandidate = createObservedTestFailureRelationProofCandidate(built.relation);
  const proofValidation = validateObservedTestFailureRelationProof(
    proofCandidate,
    input.source,
    built.relation
  );
  if (!proofValidation.accepted) {
    return {
      relationsSeen: 1,
      spanProofsInserted: spanProofResult.proofsInserted,
      relationProofsInserted: 0,
      claimsInserted: 0,
      claimEdgesInserted: 0,
      rejectedProofs: [{ sourceId: input.source.sourceId, reason: proofValidation.rejectionReason }],
      rejectedCandidates: []
    };
  }

  const relationProof = toRelationProofRecord(proofCandidate, input.now);
  const relationProofInserted = insertRelationProof(input.proofRepositories.proofs, relationProof) ? 1 : 0;
  const draft = createObservedTestFailureRelationClaimDraft(built.relation);
  const storedProof = input.proofRepositories.proofs.get(relationProof.proofId);
  const gate = evaluateObservedTestFailureRelationClaimGate({
    source: input.source,
    proof: storedProof,
    relation: built.relation
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
      relationsSeen: 1,
      spanProofsInserted: spanProofResult.proofsInserted,
      relationProofsInserted: relationProofInserted,
      claimsInserted: 0,
      claimEdgesInserted: 0,
      proofId: relationProof.proofId,
      claimId: draft.claimId,
      rejectedProofs: [],
      rejectedCandidates: [{ candidateId: draft.candidateId, reason: gate.reason }]
    };
  }

  const claimsInserted = insertVerifiedClaim({ repositories: input.repositories, draft, now: input.now })
    ? 1
    : 0;
  attachProofToClaim(
    input.proofRepositories.proofs,
    storedProof,
    draft.claimId,
    "observed test failure relation"
  );

  let claimEdgesInserted = 0;
  if (
    input.repositories.claimEdges.insertOrIgnore({
      edgeId: `edge:${sha256(
        JSON.stringify(["related_to", input.observedRunClaimId, draft.claimId])
      ).slice(0, 24)}`,
      sourceClaimId: input.observedRunClaimId,
      targetClaimId: draft.claimId,
      edgeType: "related_to",
      authority: {
        createdBy: "grape_observed",
        confidence: 0.5,
        reason: "observed test failure candidate span link",
        metadataJson: JSON.stringify({
          observedRunId: built.relation.observedRunId,
          relationHash: built.relation.relationHash
        }),
        createdAt: input.now
      },
      createdAt: input.now
    })
  ) {
    claimEdgesInserted = 1;
  }

  return {
    relationsSeen: 1,
    spanProofsInserted: spanProofResult.proofsInserted,
    relationProofsInserted: relationProofInserted,
    claimsInserted,
    claimEdgesInserted,
    proofId: relationProof.proofId,
    claimId: draft.claimId,
    rejectedProofs: [],
    rejectedCandidates: candidatesInserted > 0 ? [] : [{ candidateId: draft.candidateId, reason: "candidate_exists" }]
  };
}

function toArtifactSources(sources: readonly SourceRecord[]): RepositoryArtifactSourceInput[] {
  return sources
    .filter((source) => source.sourceType === "repository_file")
    .map((source) => ({
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      sourceRef: source.sourceRef,
      sourceHash: source.sourceHash,
      sourceScope: source.sourceScope,
      trustClass: source.trustClass,
      privacyStatus: source.privacyStatus,
      redactionStatus: source.redactionStatus
    }));
}

function manifestPackageRootsFromClaims(
  claims: readonly { readonly claimType: string; readonly scopeJson: string }[]
): ObservedTestFailureManifestPackageRootEvidence[] {
  return claims
    .filter((claim) => claim.claimType === "package_manifest_dependency_exists")
    .map((claim) => {
      const scope = JSON.parse(claim.scopeJson) as Record<string, unknown>;
      const manifestRef = typeof scope.manifestRef === "string" ? scope.manifestRef : "";
      const packageRootRef = typeof scope.packageRoot === "string" ? scope.packageRoot : "";
      if (!manifestRef || !packageRootRef) return undefined;
      return { manifestRef, packageRootRef };
    })
    .filter((entry): entry is ObservedTestFailureManifestPackageRootEvidence => Boolean(entry));
}

function toRelationProofRecord(
  candidate: ReturnType<typeof createObservedTestFailureRelationProofCandidate>,
  now: string
): ProofRecord {
  return {
    proofId: candidate.proofId,
    sourceId: candidate.sourceId,
    proofType: observedTestFailureRelationProofType,
    sourceHash: candidate.sourceHash,
    excerptHash: candidate.relationHash,
    supportStatus: "direct",
    createdAt: now
  };
}

function insertRelationProof(
  proofs: ProofStorageRepositories["proofs"],
  proof: ProofRecord
): boolean {
  if (proofs.insertOrIgnore(proof)) return true;
  assertMatchingProof(proofs.get(proof.proofId), proof, {
    context: "observed test failure relation",
    excerptHashLabel: "proof relation hash"
  });
  return false;
}

function emptyResult(reason?: string): PersistObservedTestFailureRelationsResult {
  return {
    relationsSeen: reason ? 1 : 0,
    spanProofsInserted: 0,
    relationProofsInserted: 0,
    claimsInserted: 0,
    claimEdgesInserted: 0,
    rejectedProofs: reason ? [{ sourceId: "unknown", reason }] : [],
    rejectedCandidates: []
  };
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
