import type {
  PrivacyStatus,
  SourceRedactionStatus,
  SourceScope,
  SourceTrustClass,
  SourceType
} from "../../shared/index.js";

export const observedRunResultProofType = "grape_observed_run_result";

export type ObservedRunSourceType = "command_run" | "test_run";

export type ObservedRunProofRejectionReason =
  | "source_missing"
  | "source_id_mismatch"
  | "source_not_trusted"
  | "source_not_allowed"
  | "source_redaction_not_redacted"
  | "unsupported_source_type"
  | "source_ref_mismatch"
  | "source_hash_mismatch"
  | "metadata_not_object"
  | "metadata_missing_required_field"
  | "metadata_hash_mismatch"
  | "raw_field_present"
  | "observed_run_id_invalid"
  | "observed_authority_invalid"
  | "hash_field_invalid"
  | "exit_code_invalid"
  | "test_passed_invalid"
  | "test_passed_mismatch"
  | "result_hash_mismatch";

export interface ObservedRunProofSource {
  readonly sourceId: string;
  readonly snapshotId?: string;
  readonly sourceType: SourceType;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: SourceScope;
  readonly trustClass: SourceTrustClass;
  readonly privacyStatus: PrivacyStatus;
  readonly redactionStatus: SourceRedactionStatus;
  readonly metadataJson: string;
}

export interface ObservedRunProofMetadata {
  readonly branch: string;
  readonly commit: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly sessionId: string;
  readonly worktreeHash: string;
  readonly observedRunId: string;
  readonly observedBy: "grape";
  readonly observedByGrape: true;
  readonly commandHash: string;
  readonly cwd: string;
  readonly exitCode: number;
  readonly stdoutHash: string;
  readonly stderrHash: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly evidenceHash: string;
  readonly redactedFields: readonly string[];
  readonly passed?: boolean;
  readonly testFramework?: string;
  readonly testFiles?: readonly string[];
}

export interface ObservedRunProofMaterial {
  readonly sourceId: string;
  readonly sourceType: ObservedRunSourceType;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: SourceScope;
  readonly metadata: ObservedRunProofMetadata;
  readonly resultHash: string;
}

export interface ObservedRunProofCandidate {
  readonly proofId: string;
  readonly sourceId: string;
  readonly sourceType: ObservedRunSourceType;
  readonly sourceHash: string;
  readonly resultHash: string;
}

export type ObservedRunProofMaterialResult =
  | { readonly accepted: true; readonly material: ObservedRunProofMaterial }
  | { readonly accepted: false; readonly rejectionReason: ObservedRunProofRejectionReason };
