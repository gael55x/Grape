import { createHash } from "node:crypto";

import type { ObservedTestFailureRelationMaterial } from "../proofs/observed-test-failure-relation-types.js";
import { observedTestFailureRelationProofId } from "../proofs/observed-test-failure-relation-hash.js";
import type { SourceScope } from "../../shared/index.js";
import { assertConservativeTrustWording } from "../../shared/trust-wording.js";
import { evaluateDurableClaimPolicy } from "./claim-policy.js";

export interface ObservedTestFailureRelationClaimSource {
  readonly sourceId: string;
  readonly sourceType: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: SourceScope;
  readonly trustClass: string;
  readonly privacyStatus: string;
  readonly redactionStatus: string;
}

export interface ObservedTestFailureRelationClaimProof {
  readonly proofId: string;
  readonly sourceId: string;
  readonly proofType: string;
  readonly sourceHash: string;
  readonly excerptHash: string;
  readonly supportStatus: string;
}

export interface ObservedTestFailureRelationClaimScope {
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
  readonly sessionId: string;
  readonly snapshotId: string;
  readonly sourceRef: string;
  readonly sourceId: string;
  readonly sourceType: "test_run";
  readonly sourceScope: SourceScope;
  readonly sourceHash: string;
  readonly proofId: string;
  readonly relationHash: string;
  readonly observedRunId: string;
  readonly observedRunClaimId: string;
  readonly observedRunProofId: string;
  readonly observedCommand: {
    readonly commandHash: string;
    readonly cwd: string;
  };
  readonly failureOutput: {
    readonly stdoutHash: string;
    readonly stderrHash: string;
    readonly failureOutputHash: string;
  };
  readonly candidateLinks: ObservedTestFailureRelationMaterial["candidateLinks"];
  readonly linkedSourceRefs: readonly string[];
  readonly testFiles?: readonly string[];
}

export interface ObservedTestFailureRelationClaimDraft {
  readonly candidateId: string;
  readonly claimId: string;
  readonly subject: string;
  readonly claimType: "observed_test_failure_span_link";
  readonly claimText: string;
  readonly scope: ObservedTestFailureRelationClaimScope;
}

export type ObservedTestFailureRelationClaimGateResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: string };

export function createObservedTestFailureRelationClaimDraft(
  relation: ObservedTestFailureRelationMaterial
): ObservedTestFailureRelationClaimDraft {
  const proofId = observedTestFailureRelationProofId(relation);
  const metadata = relation.observedRunMaterial.metadata;
  const scope: ObservedTestFailureRelationClaimScope = {
    branch: metadata.branch,
    commit: metadata.commit,
    worktreeHash: metadata.worktreeHash,
    sessionId: metadata.sessionId,
    snapshotId: metadata.snapshotId,
    sourceRef: relation.sourceRef,
    sourceId: relation.sourceId,
    sourceType: "test_run",
    sourceScope: relation.observedRunMaterial.sourceScope,
    sourceHash: relation.sourceHash,
    proofId,
    relationHash: relation.relationHash,
    observedRunId: relation.observedRunId,
    observedRunClaimId: relation.observedRunClaimId,
    observedRunProofId: relation.observedRunProofId,
    observedCommand: relation.observedCommand,
    failureOutput: relation.failureOutput,
    candidateLinks: relation.candidateLinks,
    linkedSourceRefs: relation.linkedSourceRefs,
    testFiles: metadata.testFiles
  };

  return {
    candidateId: `candidate:${stableHash(["observed_test_failure_span_link", proofId]).slice(0, 24)}`,
    claimId: observedTestFailureRelationClaimId(proofId),
    subject: relation.sourceRef,
    claimType: "observed_test_failure_span_link",
    claimText: observedTestFailureRelationClaimText(relation),
    scope
  };
}

export function evaluateObservedTestFailureRelationClaimGate(input: {
  readonly source: ObservedTestFailureRelationClaimSource | undefined;
  readonly proof: ObservedTestFailureRelationClaimProof | undefined;
  readonly relation: ObservedTestFailureRelationMaterial;
}): ObservedTestFailureRelationClaimGateResult {
  if (!input.source) return { accepted: false, reason: "source_missing" };
  if (!input.proof) return { accepted: false, reason: "proof_missing" };
  const policy = evaluateDurableClaimPolicy({
    claimType: "observed_test_failure_span_link",
    claimMeaning: "observed_failure_span_link",
    proofType: input.proof.proofType,
    sourceType: input.source.sourceType,
    supportStatus: input.proof.supportStatus,
    sourceTrustClass: input.source.trustClass,
    sourcePrivacyStatus: input.source.privacyStatus,
    sourceRedactionStatus: input.source.redactionStatus,
    observer: "grape",
    proofSignalKind: "observed_run"
  });
  if (!policy.accepted) return { accepted: false, reason: policy.reason };
  if (input.source.sourceHash !== input.relation.sourceHash) {
    return { accepted: false, reason: "source_hash_mismatch" };
  }
  if (input.proof.excerptHash !== input.relation.relationHash) {
    return { accepted: false, reason: "proof_relation_hash_mismatch" };
  }
  return { accepted: true };
}

export function observedTestFailureRelationClaimId(proofId: string): string {
  return `claim:${stableHash(["observed_test_failure_span_link", proofId]).slice(0, 24)}`;
}

function observedTestFailureRelationClaimText(relation: ObservedTestFailureRelationMaterial): string {
  const spanSummary = relation.candidateLinks
    .map((link) => {
      const testRef = link.testSpan?.sourceRef ?? "unknown-test-span";
      const sourceRef = link.candidateSourceSpan?.sourceRef ?? "no-candidate-source-span";
      return `${testRef} -> ${sourceRef}`;
    })
    .join("; ");
  const claimText = [
    "This test was observed failing and is linked to these candidate source/test spans.",
    `Observed run ${relation.observedRunId}.`,
    `Candidate links: ${spanSummary}.`,
    "This does not prove root cause, code correctness, or fix validity."
  ].join(" ");
  assertConservativeTrustWording(claimText, "observed_test_failure_relation_claim_text");
  return claimText;
}

function stableHash(parts: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
