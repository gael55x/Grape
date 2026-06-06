export type DurableClaimMeaning =
  | "source_excerpt_exists"
  | "project_rule_exists"
  | "symbol_declaration_exists"
  | "observed_run_result"
  | "runtime_behavior"
  | "correctness"
  | "root_cause"
  | "fix_success"
  | "production_behavior"
  | "architecture_conclusion"
  | "conflict_resolution";

export type DurableClaimProofSignalKind =
  | "exact_source"
  | "exact_rule"
  | "observed_run"
  | "semantic_candidate"
  | "graph_expansion"
  | "summary"
  | "compression_artifact"
  | "agent_text";

export interface DurableClaimPolicyEvaluationInput {
  readonly claimType: string;
  readonly claimMeaning: DurableClaimMeaning;
  readonly proofType: string;
  readonly sourceType: string;
  readonly supportStatus: string;
  readonly sourceTrustClass: string;
  readonly sourcePrivacyStatus: string;
  readonly sourceRedactionStatus: string;
  readonly observer: string;
  readonly proofSignalKind: DurableClaimProofSignalKind;
  readonly authorityClass?: string;
}

export type DurableClaimPolicyEvaluationResult =
  | { readonly accepted: true; readonly policyId: string }
  | { readonly accepted: false; readonly reason: string };

export interface DurableClaimPolicyDefaults {
  readonly claimMeaning: DurableClaimMeaning;
  readonly observer: string;
  readonly proofSignalKind: DurableClaimProofSignalKind;
}

interface DurableClaimPolicy {
  readonly claimType: string;
  readonly proofTypes: readonly string[];
  readonly sourceTypes: readonly string[];
  readonly supportStatuses: readonly string[];
  readonly observers: readonly string[];
  readonly proofSignalKinds: readonly DurableClaimProofSignalKind[];
  readonly claimMeanings: readonly DurableClaimMeaning[];
  readonly requiredRedactionStatuses?: readonly string[];
}

export const durableClaimPolicies: readonly DurableClaimPolicy[] = [
  {
    claimType: "repository_source_excerpt_exists",
    proofTypes: ["exact_source_excerpt"],
    sourceTypes: ["repository_file", "rule_file", "config_file", "lockfile", "migration_file"],
    supportStatuses: ["direct"],
    observers: ["local_source_reader"],
    proofSignalKinds: ["exact_source"],
    claimMeanings: ["source_excerpt_exists"]
  },
  {
    claimType: "project_rule",
    proofTypes: ["exact_project_rule_excerpt"],
    sourceTypes: ["rule_file"],
    supportStatuses: ["direct"],
    observers: ["local_source_reader"],
    proofSignalKinds: ["exact_rule"],
    claimMeanings: ["project_rule_exists"]
  },
  {
    claimType: "repository_symbol_declaration_exists",
    proofTypes: ["provider_symbol_declaration"],
    sourceTypes: ["repository_file"],
    supportStatuses: ["direct"],
    observers: ["local_source_reader"],
    proofSignalKinds: ["exact_source"],
    claimMeanings: ["symbol_declaration_exists"]
  },
  {
    claimType: "grape_observed_run_result",
    proofTypes: ["grape_observed_run_result"],
    sourceTypes: ["command_run", "test_run"],
    supportStatuses: ["direct"],
    observers: ["grape"],
    proofSignalKinds: ["observed_run"],
    claimMeanings: ["observed_run_result"],
    requiredRedactionStatuses: ["redacted"]
  }
];

const nonProofSignalReasons: Readonly<Record<string, string>> = {
  agent_text: "agent_text_not_proof",
  compression_artifact: "compression_artifact_not_proof",
  graph_expansion: "graph_expansion_not_proof",
  semantic_candidate: "semantic_candidate_not_proof",
  summary: "summary_not_proof"
};

export function evaluateDurableClaimPolicy(
  input: DurableClaimPolicyEvaluationInput
): DurableClaimPolicyEvaluationResult {
  const policy = durableClaimPolicies.find((candidate) => candidate.claimType === input.claimType);
  if (!policy) return { accepted: false, reason: "claim_type_not_enabled" };
  if (input.authorityClass === "model_inferred") {
    return { accepted: false, reason: "model_inferred_not_allowed" };
  }

  const nonProofReason = nonProofSignalReasons[input.proofSignalKind];
  if (nonProofReason) return { accepted: false, reason: nonProofReason };
  if (!policy.proofSignalKinds.includes(input.proofSignalKind)) {
    return { accepted: false, reason: "proof_signal_not_allowed" };
  }

  if (!policy.claimMeanings.includes(input.claimMeaning)) {
    return { accepted: false, reason: "claim_meaning_not_allowed" };
  }
  if (input.sourceTrustClass !== "trusted") return { accepted: false, reason: "source_not_trusted" };
  if (input.sourcePrivacyStatus !== "allowed") return { accepted: false, reason: "source_not_allowed" };
  if (input.sourceRedactionStatus === "blocked") {
    return { accepted: false, reason: "source_redaction_blocked" };
  }
  if (
    policy.requiredRedactionStatuses &&
    !policy.requiredRedactionStatuses.includes(input.sourceRedactionStatus)
  ) {
    return { accepted: false, reason: "source_not_redacted" };
  }
  if (!policy.sourceTypes.includes(input.sourceType)) {
    return { accepted: false, reason: "source_type_not_allowed" };
  }
  if (!policy.proofTypes.includes(input.proofType)) {
    return { accepted: false, reason: "proof_type_not_allowed" };
  }
  if (!policy.supportStatuses.includes(input.supportStatus)) {
    return { accepted: false, reason: "proof_not_direct" };
  }
  if (!policy.observers.includes(input.observer)) {
    return { accepted: false, reason: "observer_not_allowed" };
  }
  return { accepted: true, policyId: policy.claimType };
}

export function durableClaimPolicyDefaultsForClaimType(
  claimType: string
): DurableClaimPolicyDefaults | undefined {
  const policy = durableClaimPolicies.find((candidate) => candidate.claimType === claimType);
  if (!policy) return undefined;
  const claimMeaning = policy.claimMeanings[0];
  const observer = policy.observers[0];
  const proofSignalKind = policy.proofSignalKinds[0];
  if (!claimMeaning || !observer || !proofSignalKind) return undefined;
  return { claimMeaning, observer, proofSignalKind };
}
