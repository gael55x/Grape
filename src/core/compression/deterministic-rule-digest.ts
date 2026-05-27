import { hashStableJson } from "./stable-hash.js";

export interface RuleDigestRuleInput {
  readonly proofId: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly excerptHash: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly truncated: boolean;
}

export interface BuildRuleDigestCompressionInput {
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
  readonly rules: readonly RuleDigestRuleInput[];
  readonly createdAt: string;
}

export interface RuleDigestCompressionInputRef {
  readonly kind: "rule";
  readonly ref: string;
  readonly hash: string;
}

export interface DeterministicRuleDigestArtifact {
  readonly compressionId: string;
  readonly type: "rule_digest";
  readonly method: "deterministic";
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly summaryText: string;
  readonly inputRefs: readonly RuleDigestCompressionInputRef[];
  readonly inputHash: string;
  readonly inputHashes: readonly string[];
  readonly policyHash: string;
  readonly scopeHash: string;
  readonly outputHash: string;
  readonly createdAt: string;
}

const policy = {
  type: "rule_digest",
  method: "deterministic",
  version: 1,
  maxRules: 20
} as const;

export function buildRuleDigestCompressionArtifact(
  input: BuildRuleDigestCompressionInput
): DeterministicRuleDigestArtifact | undefined {
  if (input.rules.length === 0) return undefined;

  const inputRefs = compressionInputRefs(input.rules);
  const policyHash = hashStableJson(policy);
  const scopeHash = hashStableJson({
    repoId: input.repoId,
    snapshotId: input.snapshotId,
    worktreeStateId: input.worktreeStateId,
    branch: input.branch,
    commit: input.commit,
    worktreeHash: input.worktreeHash
  });
  const inputHash = hashStableJson(inputRefs);
  const summaryText = ruleDigestSummary(input);
  const outputHash = hashStableJson({ summaryText, inputHash, policyHash, scopeHash });
  const compressionId = `compression:rule_digest:${outputHash.slice(0, 24)}`;

  return {
    compressionId,
    type: "rule_digest",
    method: "deterministic",
    projectId: input.projectId,
    repoId: input.repoId,
    snapshotId: input.snapshotId,
    worktreeStateId: input.worktreeStateId,
    summaryText,
    inputRefs,
    inputHash,
    inputHashes: inputRefs.map((ref) => ref.hash),
    policyHash,
    scopeHash,
    outputHash,
    createdAt: input.createdAt
  };
}

function compressionInputRefs(rules: readonly RuleDigestRuleInput[]): readonly RuleDigestCompressionInputRef[] {
  return [...rules]
    .sort((left, right) => `${left.sourceRef}:${left.proofId}`.localeCompare(`${right.sourceRef}:${right.proofId}`))
    .map((rule) => ({
      kind: "rule" as const,
      ref: rule.proofId,
      hash: hashStableJson({
        sourceHash: rule.sourceHash,
        excerptHash: rule.excerptHash,
        startLine: rule.startLine,
        endLine: rule.endLine,
        truncated: rule.truncated
      })
    }));
}

function ruleDigestSummary(input: BuildRuleDigestCompressionInput): string {
  const sortedRules = [...input.rules].sort((left, right) =>
    `${left.sourceRef}:${left.proofId}`.localeCompare(`${right.sourceRef}:${right.proofId}`)
  );
  const shownRules = sortedRules.slice(0, policy.maxRules);
  const omitted = sortedRules.length - shownRules.length;

  return [
    `Deterministic rule digest for ${input.branch}@${input.commit}`,
    `Active rule files: ${input.rules.length}`,
    "Rules:",
    ...shownRules.map(
      (rule) =>
        `- ${rule.sourceRef} lines ${rule.startLine}-${rule.endLine} proof ${rule.proofId} excerpt ${rule.excerptHash}${
          rule.truncated ? " truncated" : ""
        }`
    ),
    omitted > 0 ? `Additional rule entries omitted from digest display: ${omitted}` : undefined
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
}
