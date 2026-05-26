import { createHash } from "node:crypto";

import type {
  PrivacyStatus,
  SourceRedactionStatus,
  SourceTrustClass,
  SourceType
} from "../../shared/index.js";

export type ExactSourceProofRejectionReason =
  | "source_missing"
  | "source_id_mismatch"
  | "source_not_trusted"
  | "source_not_allowed"
  | "source_redaction_blocked"
  | "unsupported_source_type"
  | "source_hash_mismatch"
  | "excerpt_hash_mismatch";

export interface ExactSourceProofCandidate {
  readonly proofId: string;
  readonly sourceId: string;
  readonly sourceType: SourceType;
  readonly sourceHash: string;
  readonly excerpt: string;
  readonly excerptHash: string;
}

export interface ExactSourceProofSource {
  readonly sourceId: string;
  readonly sourceType: SourceType;
  readonly sourceHash: string;
  readonly trustClass: SourceTrustClass;
  readonly privacyStatus: PrivacyStatus;
  readonly redactionStatus: SourceRedactionStatus;
}

export interface ExactSourceProofValidationResult {
  readonly accepted: boolean;
  readonly rejectionReason?: ExactSourceProofRejectionReason;
}

const exactSourceProofTypes: ReadonlySet<SourceType> = new Set([
  "repository_file",
  "rule_file",
  "config_file",
  "lockfile",
  "migration_file"
]);

export function validateExactSourceProof(
  candidate: ExactSourceProofCandidate,
  source: ExactSourceProofSource | undefined
): ExactSourceProofValidationResult {
  if (!source) return reject("source_missing");
  if (source.sourceId !== candidate.sourceId) return reject("source_id_mismatch");
  if (source.trustClass !== "trusted") return reject("source_not_trusted");
  if (source.privacyStatus !== "allowed") return reject("source_not_allowed");
  if (source.redactionStatus === "blocked") return reject("source_redaction_blocked");
  if (!exactSourceProofTypes.has(candidate.sourceType) || source.sourceType !== candidate.sourceType) {
    return reject("unsupported_source_type");
  }
  if (source.sourceHash !== candidate.sourceHash) return reject("source_hash_mismatch");
  if (sha256(candidate.excerpt) !== candidate.excerptHash) return reject("excerpt_hash_mismatch");
  return { accepted: true };
}

function reject(rejectionReason: ExactSourceProofRejectionReason): ExactSourceProofValidationResult {
  return { accepted: false, rejectionReason };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
