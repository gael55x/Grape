import {
  buildContextPackSummaryCompressionArtifact,
  buildRuleDigestCompressionArtifact,
  buildSymbolOutlineCompressionArtifact
} from "../../core/compression/index.js";
import type { ContextPackSummarySentItemInput } from "../../core/compression/index.js";
import type { RepositoryArtifactCompressionInput } from "../../core/compiler/index.js";
import type {
  CompressionStorageRepositories,
  CompressionInputKind
} from "../../core/storage/index.js";
import type {
  RepositoryArtifactSourceExcerptInput,
  RepositoryArtifactSymbolEdgeInput,
  RepositoryArtifactSymbolNodeInput
} from "../../core/compiler/index.js";
import type { createGitRepoSnapshot } from "../../core/git/index.js";
import { sha256 } from "./compile-ids.js";

export interface PrepareLocalCompressionArtifactsInput {
  readonly repositories: CompressionStorageRepositories;
  readonly projectId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly snapshot: ReturnType<typeof createGitRepoSnapshot>;
  readonly sourceExcerpts: readonly RepositoryArtifactSourceExcerptInput[];
  readonly symbolNodes: readonly RepositoryArtifactSymbolNodeInput[];
  readonly symbolEdges: readonly RepositoryArtifactSymbolEdgeInput[];
  readonly now: string;
}

export interface PrepareLocalCompileCompressionArtifactsInput extends PrepareLocalCompressionArtifactsInput {
  readonly sessionId: string;
  readonly sentItems: readonly ContextPackSummarySentItemInput[];
}

export interface PersistLocalContextPackSummaryCompressionInput {
  readonly repositories: CompressionStorageRepositories;
  readonly projectId: string;
  readonly snapshotId: string;
  readonly worktreeStateId: string;
  readonly snapshot: ReturnType<typeof createGitRepoSnapshot>;
  readonly sessionId: string;
  readonly sentItems: readonly ContextPackSummarySentItemInput[];
  readonly now: string;
}

type LocalCompressionArtifact = NonNullable<
  | ReturnType<typeof buildSymbolOutlineCompressionArtifact>
  | ReturnType<typeof buildRuleDigestCompressionArtifact>
  | ReturnType<typeof buildContextPackSummaryCompressionArtifact>
>;

export function prepareLocalCompressionArtifacts(
  input: PrepareLocalCompressionArtifactsInput
): readonly RepositoryArtifactCompressionInput[] {
  const symbolOutline = buildSymbolOutlineCompressionArtifact({
    projectId: input.projectId,
    repoId: input.snapshot.repoId,
    snapshotId: input.snapshotId,
    worktreeStateId: input.worktreeStateId,
    branch: input.snapshot.branch,
    commit: input.snapshot.commit,
    worktreeHash: input.snapshot.worktreeHash,
    symbolNodes: input.symbolNodes,
    symbolEdges: input.symbolEdges,
    createdAt: input.now
  });
  const ruleDigest = buildRuleDigestCompressionArtifact({
    projectId: input.projectId,
    repoId: input.snapshot.repoId,
    snapshotId: input.snapshotId,
    worktreeStateId: input.worktreeStateId,
    branch: input.snapshot.branch,
    commit: input.snapshot.commit,
    worktreeHash: input.snapshot.worktreeHash,
    rules: input.sourceExcerpts
      .filter((excerpt) => excerpt.sourceType === "rule_file")
      .map((excerpt) => ({
        proofId: excerpt.proofId,
        sourceRef: excerpt.sourceRef,
        sourceHash: excerpt.sourceHash,
        excerptHash: excerpt.excerptHash,
        startLine: excerpt.startLine,
        endLine: excerpt.endLine,
        truncated: excerpt.truncated
      })),
    createdAt: input.now
  });

  const artifacts = [symbolOutline, ruleDigest].filter((artifact) => artifact !== undefined);
  for (const artifact of artifacts) persistCompressionArtifact(input.repositories, artifact, input.now);

  return artifacts.map((artifact) => ({
    compressionId: artifact.compressionId,
    type: artifact.type,
    summaryText: artifact.summaryText,
    inputRefs: artifact.inputRefs.map((ref) => ref.ref),
    inputHashes: artifact.inputHashes,
    inputHash: artifact.inputHash,
    policyHash: artifact.policyHash,
    scopeHash: artifact.scopeHash,
    outputHash: artifact.outputHash
  }));
}

export function prepareLocalCompileCompressionArtifacts(
  input: PrepareLocalCompileCompressionArtifactsInput
): readonly RepositoryArtifactCompressionInput[] {
  const orientationArtifacts = prepareLocalCompressionArtifacts(input);
  const priorContextPackSummary = prepareLocalContextPackSummaryCompressionArtifact({
    repositories: input.repositories,
    projectId: input.projectId,
    snapshotId: input.snapshotId,
    worktreeStateId: input.worktreeStateId,
    snapshot: input.snapshot,
    sessionId: input.sessionId,
    sentItems: input.sentItems,
    now: input.now
  });

  return [
    ...orientationArtifacts,
    ...(priorContextPackSummary ? [priorContextPackSummary] : [])
  ];
}

export function persistLocalContextPackSummaryCompressionArtifact(
  input: PersistLocalContextPackSummaryCompressionInput
): void {
  prepareLocalContextPackSummaryCompressionArtifact(input);
}

export function prepareLocalContextPackSummaryCompressionArtifact(
  input: PersistLocalContextPackSummaryCompressionInput
): RepositoryArtifactCompressionInput | undefined {
  const contextPackSummary = buildContextPackSummaryCompressionArtifact({
    projectId: input.projectId,
    repoId: input.snapshot.repoId,
    snapshotId: input.snapshotId,
    worktreeStateId: input.worktreeStateId,
    sessionId: input.sessionId,
    branch: input.snapshot.branch,
    commit: input.snapshot.commit,
    worktreeHash: input.snapshot.worktreeHash,
    sentItems: input.sentItems,
    createdAt: input.now
  });

  if (!contextPackSummary) return undefined;
  persistCompressionArtifact(input.repositories, contextPackSummary, input.now);
  return {
    compressionId: contextPackSummary.compressionId,
    type: contextPackSummary.type,
    summaryText: contextPackSummary.summaryText,
    inputRefs: contextPackSummary.inputRefs.map((ref) => ref.ref),
    inputHashes: contextPackSummary.inputHashes,
    inputHash: contextPackSummary.inputHash,
    policyHash: contextPackSummary.policyHash,
    scopeHash: contextPackSummary.scopeHash,
    outputHash: contextPackSummary.outputHash
  };
}

function persistCompressionArtifact(
  repositories: CompressionStorageRepositories,
  artifact: LocalCompressionArtifact,
  now: string
): void {
  repositories.compressionArtifacts.upsert({
    compressionId: artifact.compressionId,
    projectId: artifact.projectId,
    repoId: artifact.repoId,
    repoSnapshotId: artifact.snapshotId,
    worktreeStateId: artifact.worktreeStateId,
    artifactType: artifact.type,
    method: artifact.method,
    summaryText: artifact.summaryText,
    inputHash: artifact.inputHash,
    policyHash: artifact.policyHash,
    scopeHash: artifact.scopeHash,
    outputHash: artifact.outputHash,
    trustStatus: "derived_cache",
    createdAt: artifact.createdAt,
    updatedAt: now
  });

  for (const ref of artifact.inputRefs) {
    repositories.compressionInputs.upsert({
      compressionInputId: `compression_input:${sha256(`${artifact.compressionId}:${ref.ref}:${ref.hash}`).slice(0, 24)}`,
      compressionId: artifact.compressionId,
      inputKind: ref.kind as CompressionInputKind,
      inputRef: ref.ref,
      inputHash: ref.hash
    });
  }
}
