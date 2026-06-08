import { hashStableJson } from "./stable-hash.js";

export interface ContextPackSummarySentItemInput {
  readonly sentItemId: string;
  readonly artifactId: string;
  readonly sectionId: string;
  readonly itemKind: string;
  readonly itemRef: string;
  readonly itemHash: string;
  readonly contentHash: string;
  readonly diffState: string;
  readonly wasPinned: boolean;
  readonly firstSentAt: string;
  readonly lastSentAt: string;
  readonly sendCount: number;
  readonly tokenCount: number;
}

export interface BuildContextPackSummaryCompressionInput {
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly sessionId: string;
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
  readonly sentItems: readonly ContextPackSummarySentItemInput[];
  readonly createdAt: string;
}

export interface ContextPackSummaryCompressionInputRef {
  readonly kind: "context_artifact";
  readonly ref: string;
  readonly hash: string;
}

export interface DeterministicContextPackSummaryArtifact {
  readonly compressionId: string;
  readonly type: "context_pack_summary";
  readonly method: "deterministic";
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly summaryText: string;
  readonly inputRefs: readonly ContextPackSummaryCompressionInputRef[];
  readonly inputHash: string;
  readonly inputHashes: readonly string[];
  readonly policyHash: string;
  readonly scopeHash: string;
  readonly outputHash: string;
  readonly createdAt: string;
}

const policy = {
  type: "context_pack_summary",
  method: "deterministic",
  version: 1,
  maxItems: 40
} as const;

export function buildContextPackSummaryCompressionArtifact(
  input: BuildContextPackSummaryCompressionInput
): DeterministicContextPackSummaryArtifact | undefined {
  if (input.sentItems.length === 0) return undefined;

  const inputRefs = compressionInputRefs(input.sentItems);
  const policyHash = hashStableJson(policy);
  const scopeHash = hashStableJson({
    repoId: input.repoId,
    snapshotId: input.snapshotId,
    worktreeStateId: input.worktreeStateId,
    sessionId: input.sessionId,
    branch: input.branch,
    commit: input.commit,
    worktreeHash: input.worktreeHash
  });
  const inputHash = hashStableJson(inputRefs);
  const summaryText = contextPackSummary(input);
  const outputHash = hashStableJson({ summaryText, inputHash, policyHash, scopeHash });
  const compressionId = `compression:context_pack_summary:${outputHash.slice(0, 24)}`;

  return {
    compressionId,
    type: "context_pack_summary",
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

function compressionInputRefs(
  sentItems: readonly ContextPackSummarySentItemInput[]
): readonly ContextPackSummaryCompressionInputRef[] {
  return sortedSentItems(sentItems).map((item) => ({
    kind: "context_artifact" as const,
    ref: `${item.artifactId}:${item.sentItemId}`,
    hash: hashStableJson({
      sentItemId: item.sentItemId,
      artifactId: item.artifactId,
      sectionId: item.sectionId,
      itemKind: item.itemKind,
      itemRef: item.itemRef,
      itemHash: item.itemHash,
      contentHash: item.contentHash,
      diffState: item.diffState,
      wasPinned: item.wasPinned,
      firstSentAt: item.firstSentAt,
      lastSentAt: item.lastSentAt,
      sendCount: item.sendCount,
      tokenCount: item.tokenCount
    })
  }));
}

function contextPackSummary(input: BuildContextPackSummaryCompressionInput): string {
  const sentItems = sortedSentItems(input.sentItems);
  const shownItems = sentItems.slice(0, policy.maxItems);
  const omitted = sentItems.length - shownItems.length;

  return [
    "Non-authoritative orientation digest: deterministic context pack summary.",
    `Deterministic context pack summary for ${input.sessionId} on ${input.branch}@${input.commit}`,
    `Prior sent items: ${input.sentItems.length}`,
    "Items:",
    ...shownItems.map(
      (item) =>
        `- ${item.sentItemId} ${item.diffState} ${item.itemKind}:${item.itemRef} section ${item.sectionId} hash ${item.contentHash} lastSent ${item.lastSentAt} tokens ${item.tokenCount}${
          item.wasPinned ? " pinned" : ""
        }`
    ),
    omitted > 0 ? `Additional sent items omitted from digest display: ${omitted}` : undefined
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
}

function sortedSentItems(
  sentItems: readonly ContextPackSummarySentItemInput[]
): readonly ContextPackSummarySentItemInput[] {
  return [...sentItems].sort((left, right) => {
    const leftKey = `${left.lastSentAt}:${left.sectionId}:${left.sentItemId}`;
    const rightKey = `${right.lastSentAt}:${right.sectionId}:${right.sentItemId}`;
    return leftKey.localeCompare(rightKey);
  });
}
