import { extractObservedRunProofMaterial } from "./observed-run-proof-material.js";
import type {
  ObservedRunProofCandidate,
  ObservedRunProofMaterial,
  ObservedRunProofRejectionReason,
  ObservedRunProofSource
} from "./observed-run-proof-types.js";

export type ObservedRunProofValidationResult =
  | { readonly accepted: true; readonly material: ObservedRunProofMaterial }
  | { readonly accepted: false; readonly rejectionReason: ObservedRunProofRejectionReason };

export function validateObservedRunProof(
  candidate: ObservedRunProofCandidate,
  source: ObservedRunProofSource | undefined
): ObservedRunProofValidationResult {
  const extracted = extractObservedRunProofMaterial(source);
  if (!extracted.accepted) return extracted;
  const { material } = extracted;
  if (material.sourceId !== candidate.sourceId) return reject("source_id_mismatch");
  if (material.sourceType !== candidate.sourceType) return reject("unsupported_source_type");
  if (material.sourceHash !== candidate.sourceHash) return reject("source_hash_mismatch");
  if (material.resultHash !== candidate.resultHash) return reject("result_hash_mismatch");
  return { accepted: true, material };
}

function reject(rejectionReason: ObservedRunProofRejectionReason): ObservedRunProofValidationResult {
  return { accepted: false, rejectionReason };
}
