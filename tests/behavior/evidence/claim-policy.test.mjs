import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDurableClaimPolicy } from "../../../.tmp/build/src/core/claims/index.js";

const sourceExcerptPolicyInput = {
  claimType: "repository_source_excerpt_exists",
  claimMeaning: "source_excerpt_exists",
  proofType: "exact_source_excerpt",
  sourceType: "repository_file",
  supportStatus: "direct",
  sourceTrustClass: "trusted",
  sourcePrivacyStatus: "allowed",
  sourceRedactionStatus: "not_needed",
  observer: "local_source_reader",
  proofSignalKind: "exact_source"
};

const projectRulePolicyInput = {
  claimType: "project_rule",
  claimMeaning: "project_rule_exists",
  proofType: "exact_project_rule_excerpt",
  sourceType: "rule_file",
  supportStatus: "direct",
  sourceTrustClass: "trusted",
  sourcePrivacyStatus: "allowed",
  sourceRedactionStatus: "not_needed",
  observer: "local_source_reader",
  proofSignalKind: "exact_rule"
};

const observedRunPolicyInput = {
  claimType: "grape_observed_run_result",
  claimMeaning: "observed_run_result",
  proofType: "grape_observed_run_result",
  sourceType: "test_run",
  supportStatus: "direct",
  sourceTrustClass: "trusted",
  sourcePrivacyStatus: "allowed",
  sourceRedactionStatus: "redacted",
  observer: "grape",
  proofSignalKind: "observed_run"
};

test("claim_type_policy_rejects_unknown_claim_type", () => {
  const result = evaluateDurableClaimPolicy({
    ...sourceExcerptPolicyInput,
    claimType: "runtime_behavior"
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "claim_type_not_enabled");
});

test("claim_type_policy_rejects_unproven_behavior_claim", () => {
  const result = evaluateDurableClaimPolicy({
    ...sourceExcerptPolicyInput,
    claimMeaning: "runtime_behavior"
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "claim_meaning_not_allowed");
});

test("observed_test_result_does_not_promote_correctness", () => {
  const allowed = evaluateDurableClaimPolicy(observedRunPolicyInput);
  assert.equal(allowed.accepted, true);

  const overclaim = evaluateDurableClaimPolicy({
    ...observedRunPolicyInput,
    claimMeaning: "correctness"
  });

  assert.equal(overclaim.accepted, false);
  assert.equal(overclaim.reason, "claim_meaning_not_allowed");
});

test("source_excerpt_claim_proves_existence_only", () => {
  const allowed = evaluateDurableClaimPolicy(sourceExcerptPolicyInput);
  assert.equal(allowed.accepted, true);

  const overclaim = evaluateDurableClaimPolicy({
    ...sourceExcerptPolicyInput,
    claimMeaning: "root_cause"
  });

  assert.equal(overclaim.accepted, false);
  assert.equal(overclaim.reason, "claim_meaning_not_allowed");
});

test("project_rule_claim_does_not_resolve_rule_conflict", () => {
  const allowed = evaluateDurableClaimPolicy(projectRulePolicyInput);
  assert.equal(allowed.accepted, true);

  const overclaim = evaluateDurableClaimPolicy({
    ...projectRulePolicyInput,
    claimMeaning: "conflict_resolution"
  });

  assert.equal(overclaim.accepted, false);
  assert.equal(overclaim.reason, "claim_meaning_not_allowed");
});

test("semantic_candidate_cannot_create_claim", () => {
  const result = evaluateDurableClaimPolicy({
    ...sourceExcerptPolicyInput,
    proofSignalKind: "semantic_candidate"
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "semantic_candidate_not_proof");
});

test("graph_expansion_cannot_satisfy_claim_policy", () => {
  const result = evaluateDurableClaimPolicy({
    ...sourceExcerptPolicyInput,
    proofSignalKind: "graph_expansion"
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "graph_expansion_not_proof");
});

test("summary_or_compression_artifact_cannot_satisfy_claim_policy", () => {
  const summary = evaluateDurableClaimPolicy({
    ...sourceExcerptPolicyInput,
    proofSignalKind: "summary"
  });
  const compression = evaluateDurableClaimPolicy({
    ...sourceExcerptPolicyInput,
    proofSignalKind: "compression_artifact"
  });

  assert.equal(summary.accepted, false);
  assert.equal(summary.reason, "summary_not_proof");
  assert.equal(compression.accepted, false);
  assert.equal(compression.reason, "compression_artifact_not_proof");
});
