import { hashStableJson } from "./stable-hash.js";

export interface SymbolOutlineNodeInput {
  readonly symbolId: string;
  readonly path: string;
  readonly name: string;
  readonly symbolKind: string;
  readonly confidence: string;
  readonly bodyHash?: string;
  readonly signatureHash?: string;
}

export interface SymbolOutlineEdgeInput {
  readonly edgeId: string;
  readonly edgeType: string;
  readonly fromSymbolId: string;
  readonly toSymbolId?: string;
  readonly toRef?: string;
}

export interface BuildSymbolOutlineCompressionInput {
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
  readonly symbolNodes: readonly SymbolOutlineNodeInput[];
  readonly symbolEdges: readonly SymbolOutlineEdgeInput[];
  readonly createdAt: string;
}

export interface CompressionArtifactInputRef {
  readonly kind: "symbol";
  readonly ref: string;
  readonly hash: string;
}

export interface DeterministicCompressionArtifact {
  readonly compressionId: string;
  readonly type: "symbol_outline";
  readonly method: "deterministic";
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly summaryText: string;
  readonly inputRefs: readonly CompressionArtifactInputRef[];
  readonly inputHash: string;
  readonly inputHashes: readonly string[];
  readonly policyHash: string;
  readonly scopeHash: string;
  readonly outputHash: string;
  readonly createdAt: string;
}

const policy = {
  type: "symbol_outline",
  method: "deterministic",
  version: 1,
  maxNodes: 40,
  maxEdges: 40
} as const;

export function buildSymbolOutlineCompressionArtifact(
  input: BuildSymbolOutlineCompressionInput
): DeterministicCompressionArtifact | undefined {
  const inputRefs = compressionInputRefs(input);
  if (inputRefs.length === 0) return undefined;

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
  const summaryText = symbolOutlineSummary(input);
  const outputHash = hashStableJson({ summaryText, inputHash, policyHash, scopeHash });
  const compressionId = `compression:symbol_outline:${outputHash.slice(0, 24)}`;

  return {
    compressionId,
    type: "symbol_outline",
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

function compressionInputRefs(input: BuildSymbolOutlineCompressionInput): readonly CompressionArtifactInputRef[] {
  return [
    ...input.symbolNodes.map((node) => ({
      kind: "symbol" as const,
      ref: node.symbolId,
      hash: node.bodyHash ?? node.signatureHash ?? hashStableJson(node)
    })),
    ...input.symbolEdges.map((edge) => ({
      kind: "symbol" as const,
      ref: edge.edgeId,
      hash: hashStableJson(edge)
    }))
  ].sort((left, right) => left.ref.localeCompare(right.ref));
}

function symbolOutlineSummary(input: BuildSymbolOutlineCompressionInput): string {
  const nodes = [...input.symbolNodes]
    .sort((left, right) => `${left.path}:${left.name}`.localeCompare(`${right.path}:${right.name}`))
    .slice(0, policy.maxNodes);
  const edges = [...input.symbolEdges]
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId))
    .slice(0, policy.maxEdges);

  return [
    `Deterministic symbol outline for ${input.branch}@${input.commit}`,
    `Indexed symbol nodes: ${input.symbolNodes.length}`,
    `Indexed symbol relationships: ${input.symbolEdges.length}`,
    "Symbols:",
    ...nodes.map((node) => `- ${node.path} :: ${node.name} [${node.symbolKind}, ${node.confidence}]`),
    "Relationships:",
    ...edges.map((edge) => `- ${edge.edgeType}: ${edge.fromSymbolId} -> ${relationshipTarget(edge)}`)
  ].join("\n");
}

function relationshipTarget(edge: SymbolOutlineEdgeInput): string {
  if (edge.toRef && edge.toSymbolId) return `${edge.toRef} (${edge.toSymbolId})`;
  return edge.toRef ?? edge.toSymbolId ?? "unresolved";
}
