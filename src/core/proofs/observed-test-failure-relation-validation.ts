import type {
  ObservedTestFailureRelationCandidate,
  ObservedTestFailureRelationMaterial,
  ObservedTestFailureRelationRejectionReason
} from "./observed-test-failure-relation-types.js";

export interface ObservedTestFailureRelationProofSource {
  readonly sourceId: string;
  readonly sourceType: string;
  readonly sourceHash: string;
  readonly trustClass: string;
  readonly privacyStatus: string;
}

export type ObservedTestFailureRelationValidationResult =
  | { readonly accepted: true; readonly material: ObservedTestFailureRelationMaterial }
  | { readonly accepted: false; readonly rejectionReason: ObservedTestFailureRelationRejectionReason };

export function validateObservedTestFailureRelationProof(
  candidate: ObservedTestFailureRelationCandidate,
  source: ObservedTestFailureRelationProofSource | undefined,
  material: ObservedTestFailureRelationMaterial
): ObservedTestFailureRelationValidationResult {
  if (!source) return reject("source_missing");
  if (source.sourceId !== candidate.sourceId) return reject("source_missing");
  if (source.sourceType !== "test_run") return reject("unsupported_source_type");
  if (source.trustClass !== "trusted") return reject("source_not_trusted");
  if (source.privacyStatus !== "allowed") return reject("source_not_allowed");
  if (source.sourceHash !== candidate.sourceHash) return reject("source_hash_mismatch");
  if (candidate.relationHash !== material.relationHash) return reject("relation_hash_mismatch");
  if (material.candidateLinks.length === 0) return reject("no_candidate_links");
  return { accepted: true, material };
}

function reject(
  rejectionReason: ObservedTestFailureRelationRejectionReason
): ObservedTestFailureRelationValidationResult {
  return { accepted: false, rejectionReason };
}
