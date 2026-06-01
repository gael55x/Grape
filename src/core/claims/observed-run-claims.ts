import { createHash } from "node:crypto";

import {
  observedRunProofId,
  observedRunResultProofType,
  type ObservedRunProofMaterial
} from "../proofs/index.js";
import type { SourceScope } from "../../shared/index.js";

export interface ObservedRunClaimSource {
  readonly sourceId: string;
  readonly sourceType: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: SourceScope;
  readonly trustClass: string;
  readonly privacyStatus: string;
  readonly redactionStatus: string;
}

export interface ObservedRunClaimProof {
  readonly proofId: string;
  readonly sourceId: string;
  readonly proofType: string;
  readonly sourceHash: string;
  readonly excerptHash: string;
  readonly supportStatus: string;
}

export interface ObservedRunClaimScope {
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
  readonly sourceRef: string;
  readonly sourceId: string;
  readonly sourceType: "command_run" | "test_run";
  readonly sourceScope: SourceScope;
  readonly sourceHash: string;
  readonly proofId: string;
  readonly resultHash: string;
  readonly observedRunId: string;
  readonly commandHash: string;
  readonly cwd: string;
  readonly exitCode: number;
  readonly stdoutHash: string;
  readonly stderrHash: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly sessionId: string;
  readonly snapshotId: string;
  readonly passed?: boolean;
  readonly testFramework?: string;
}

export interface ObservedRunClaimDraft {
  readonly candidateId: string;
  readonly claimId: string;
  readonly subject: string;
  readonly claimType: "grape_observed_run_result";
  readonly claimText: string;
  readonly scope: ObservedRunClaimScope;
}

export type ObservedRunClaimGateResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: string };

export function createObservedRunClaimDraft(material: ObservedRunProofMaterial): ObservedRunClaimDraft {
  const proofId = observedRunProofId(material);
  const scope: ObservedRunClaimScope = {
    branch: material.metadata.branch,
    commit: material.metadata.commit,
    worktreeHash: material.metadata.worktreeHash,
    sourceRef: material.sourceRef,
    sourceId: material.sourceId,
    sourceType: material.sourceType,
    sourceScope: material.sourceScope,
    sourceHash: material.sourceHash,
    proofId,
    resultHash: material.resultHash,
    observedRunId: material.metadata.observedRunId,
    commandHash: material.metadata.commandHash,
    cwd: material.metadata.cwd,
    exitCode: material.metadata.exitCode,
    stdoutHash: material.metadata.stdoutHash,
    stderrHash: material.metadata.stderrHash,
    startedAt: material.metadata.startedAt,
    endedAt: material.metadata.endedAt,
    sessionId: material.metadata.sessionId,
    snapshotId: material.metadata.snapshotId,
    passed: material.metadata.passed,
    testFramework: material.metadata.testFramework
  };

  return {
    candidateId: `candidate:${stableHash(["observed_run_result", proofId]).slice(0, 24)}`,
    claimId: observedRunClaimId(proofId),
    subject: material.sourceRef,
    claimType: "grape_observed_run_result",
    claimText: observedRunClaimText(material),
    scope
  };
}

export function evaluateObservedRunClaimGate(input: {
  readonly source: ObservedRunClaimSource | undefined;
  readonly proof: ObservedRunClaimProof | undefined;
  readonly material: ObservedRunProofMaterial;
}): ObservedRunClaimGateResult {
  if (!input.source) return { accepted: false, reason: "source_missing" };
  if (!input.proof) return { accepted: false, reason: "proof_missing" };
  if (input.source.trustClass !== "trusted") return { accepted: false, reason: "source_not_trusted" };
  if (input.source.privacyStatus !== "allowed") return { accepted: false, reason: "source_not_allowed" };
  if (input.source.redactionStatus !== "redacted") return { accepted: false, reason: "source_not_redacted" };
  if (input.source.sourceType !== "command_run" && input.source.sourceType !== "test_run") {
    return { accepted: false, reason: "source_type_not_allowed" };
  }
  if (input.source.sourceId !== input.material.sourceId) return { accepted: false, reason: "source_id_mismatch" };
  if (input.source.sourceHash !== input.material.sourceHash) {
    return { accepted: false, reason: "source_hash_mismatch" };
  }
  if (input.proof.proofType !== observedRunResultProofType) {
    return { accepted: false, reason: "proof_type_not_allowed" };
  }
  if (input.proof.supportStatus !== "direct") return { accepted: false, reason: "proof_not_direct" };
  if (input.proof.sourceId !== input.material.sourceId) return { accepted: false, reason: "proof_source_mismatch" };
  if (input.proof.sourceHash !== input.material.sourceHash) {
    return { accepted: false, reason: "proof_source_hash_mismatch" };
  }
  if (input.proof.excerptHash !== input.material.resultHash) {
    return { accepted: false, reason: "proof_result_hash_mismatch" };
  }
  return { accepted: true };
}

export function observedRunClaimId(proofId: string): string {
  return `claim:${stableHash(["grape_observed_run_result", proofId]).slice(0, 24)}`;
}

function observedRunClaimText(material: ObservedRunProofMaterial): string {
  if (material.sourceType === "test_run") {
    const result = material.metadata.passed ? "passed" : "failed";
    const framework = material.metadata.testFramework ? ` with ${material.metadata.testFramework}` : "";
    return [
      `Grape observed test run ${material.metadata.observedRunId}${framework} ${result}`,
      `with exit code ${material.metadata.exitCode}.`
    ].join(" ");
  }

  return [
    `Grape observed command run ${material.metadata.observedRunId}`,
    `exit with code ${material.metadata.exitCode}.`
  ].join(" ");
}

function stableHash(parts: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
