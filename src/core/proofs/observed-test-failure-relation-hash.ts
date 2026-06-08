import { createHash } from "node:crypto";

import type {
  ObservedTestFailureRelationCandidate,
  ObservedTestFailureRelationMaterial
} from "./observed-test-failure-relation-types.js";

export function observedTestFailureRelationHash(relationBody: {
  readonly observedRunId: string;
  readonly observedRunClaimId: string;
  readonly observedRunProofId: string;
  readonly observedCommand: { readonly commandHash: string; readonly cwd: string };
  readonly failureOutput: {
    readonly stdoutHash: string;
    readonly stderrHash: string;
    readonly failureOutputHash: string;
  };
  readonly candidateLinks: readonly unknown[];
}): string {
  return createHash("sha256").update(JSON.stringify(relationBody)).digest("hex");
}

export function createObservedTestFailureRelationProofCandidate(
  relation: ObservedTestFailureRelationMaterial
): ObservedTestFailureRelationCandidate {
  return {
    proofId: observedTestFailureRelationProofId(relation),
    sourceId: relation.sourceId,
    sourceHash: relation.sourceHash,
    relationHash: relation.relationHash
  };
}

export function observedTestFailureRelationProofId(relation: ObservedTestFailureRelationMaterial): string {
  return `proof:${stableHash([
    "observed_test_failure_relation",
    relation.sourceId,
    relation.sourceHash,
    relation.relationHash
  ]).slice(0, 24)}`;
}

function stableHash(parts: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
