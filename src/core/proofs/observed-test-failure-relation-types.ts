import type { ObservedRunProofMaterial } from "./observed-run-proof-types.js";

export const observedTestFailureRelationProofType = "observed_test_failure_relation";

export type ObservedTestFailureRelationRejectionReason =
  | "source_missing"
  | "source_not_trusted"
  | "source_not_allowed"
  | "unsupported_source_type"
  | "source_hash_mismatch"
  | "metadata_not_object"
  | "metadata_missing_required_field"
  | "relation_hash_mismatch"
  | "raw_field_present"
  | "observed_run_not_failed"
  | "no_candidate_links";

export interface ObservedTestFailureSpanRef {
  readonly proofId: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly excerptHash: string;
}

export interface ObservedTestFailureImportEvidence {
  readonly relationshipRef: string;
  readonly testRef: string;
  readonly sourceRef: string;
  readonly relationship: "imports" | "calls";
}

export interface ObservedTestFailurePackageBoundaryEvidence {
  readonly packageRoot: string;
  readonly sourceRef: string;
}

export interface ObservedTestFailureFilenameConventionEvidence {
  readonly testRef: string;
  readonly candidateSourceRef: string;
}

export interface ObservedTestFailureManifestPackageRootEvidence {
  readonly manifestRef: string;
  readonly packageRootRef: string;
}

export interface ObservedTestFailureCandidateLink {
  readonly linkId: string;
  readonly testSpan?: ObservedTestFailureSpanRef;
  readonly candidateSourceSpan?: ObservedTestFailureSpanRef;
  readonly importEvidence?: ObservedTestFailureImportEvidence;
  readonly packageBoundaryEvidence?: ObservedTestFailurePackageBoundaryEvidence;
  readonly filenameConventionEvidence?: ObservedTestFailureFilenameConventionEvidence;
  readonly manifestPackageRootEvidence?: ObservedTestFailureManifestPackageRootEvidence;
  readonly missingEvidenceWarnings: readonly string[];
}

export interface ObservedTestFailureRelationMaterial {
  readonly sourceId: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly observedRunId: string;
  readonly observedRunClaimId: string;
  readonly observedRunProofId: string;
  readonly observedRunMaterial: ObservedRunProofMaterial;
  readonly observedCommand: {
    readonly commandHash: string;
    readonly cwd: string;
  };
  readonly failureOutput: {
    readonly stdoutHash: string;
    readonly stderrHash: string;
    readonly failureOutputHash: string;
  };
  readonly candidateLinks: readonly ObservedTestFailureCandidateLink[];
  readonly linkedSourceRefs: readonly string[];
  readonly relationHash: string;
}

export interface ObservedTestFailureRelationCandidate {
  readonly proofId: string;
  readonly sourceId: string;
  readonly sourceHash: string;
  readonly relationHash: string;
}
