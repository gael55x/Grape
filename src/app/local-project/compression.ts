import { buildSymbolOutlineCompressionArtifact } from "../../core/compression/index.js";
import type { RepositoryArtifactCompressionInput } from "../../core/compiler/index.js";
import type { CompressionStorageRepositories } from "../../core/storage/index.js";
import type {
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
  readonly symbolNodes: readonly RepositoryArtifactSymbolNodeInput[];
  readonly symbolEdges: readonly RepositoryArtifactSymbolEdgeInput[];
  readonly now: string;
}

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

  if (!symbolOutline) return [];

  input.repositories.compressionArtifacts.upsert({
    compressionId: symbolOutline.compressionId,
    projectId: symbolOutline.projectId,
    repoId: symbolOutline.repoId,
    repoSnapshotId: symbolOutline.snapshotId,
    worktreeStateId: symbolOutline.worktreeStateId,
    artifactType: symbolOutline.type,
    method: symbolOutline.method,
    summaryText: symbolOutline.summaryText,
    inputHash: symbolOutline.inputHash,
    policyHash: symbolOutline.policyHash,
    scopeHash: symbolOutline.scopeHash,
    outputHash: symbolOutline.outputHash,
    trustStatus: "derived_cache",
    createdAt: symbolOutline.createdAt,
    updatedAt: input.now
  });

  for (const ref of symbolOutline.inputRefs) {
    input.repositories.compressionInputs.upsert({
      compressionInputId: `compression_input:${sha256(`${symbolOutline.compressionId}:${ref.ref}:${ref.hash}`).slice(0, 24)}`,
      compressionId: symbolOutline.compressionId,
      inputKind: ref.kind,
      inputRef: ref.ref,
      inputHash: ref.hash
    });
  }

  return [
    {
      compressionId: symbolOutline.compressionId,
      type: symbolOutline.type,
      summaryText: symbolOutline.summaryText,
      inputRefs: symbolOutline.inputRefs.map((ref) => ref.ref),
      inputHashes: symbolOutline.inputHashes,
      inputHash: symbolOutline.inputHash,
      policyHash: symbolOutline.policyHash,
      scopeHash: symbolOutline.scopeHash,
      outputHash: symbolOutline.outputHash
    }
  ];
}
