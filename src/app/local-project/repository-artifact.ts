import {
  compileRepositoryContextArtifact
} from "../../core/compiler/index.js";
import type {
  RepositoryArtifactActiveClaimInput,
  RepositoryArtifactCompressionInput,
  RepositoryArtifactSourceExcerptInput,
  RepositoryArtifactSourceInput,
  RepositoryArtifactSymbolEdgeInput,
  RepositoryArtifactSymbolNodeInput,
  RepositoryArtifactTaskRetrievalInput
} from "../../core/compiler/index.js";
import type { RepoSnapshot } from "../../core/git/index.js";
import type {
  CompressionStorageRepositories,
  StorageRepositories
} from "../../core/storage/index.js";
import type {
  InMemoryContextArtifactShape,
  RiskOverlay,
  TaskType
} from "../../shared/index.js";
import {
  prepareLocalCompressionArtifacts,
  prepareLocalContextPackSummaryCompressionArtifact
} from "./compression.js";
import { listCurrentContextPackSummarySentItems } from "./context-pack-summary.js";

export interface CompileLocalRepositoryArtifactInput {
  readonly repositories: StorageRepositories;
  readonly compressionRepositories: CompressionStorageRepositories;
  readonly projectId: string;
  readonly sessionId: string;
  readonly taskId: string;
  readonly taskType: TaskType;
  readonly riskOverlays: readonly RiskOverlay[];
  readonly userRequestHash: string;
  readonly snapshot: RepoSnapshot;
  readonly worktreeStateId: string;
  readonly sources: readonly RepositoryArtifactSourceInput[];
  readonly sourceExcerpts: readonly RepositoryArtifactSourceExcerptInput[];
  readonly symbolNodes: readonly RepositoryArtifactSymbolNodeInput[];
  readonly symbolEdges: readonly RepositoryArtifactSymbolEdgeInput[];
  readonly activeClaims: readonly RepositoryArtifactActiveClaimInput[];
  readonly taskRetrieval: RepositoryArtifactTaskRetrievalInput;
  readonly now: string;
}

export function compileLocalRepositoryArtifact(
  input: CompileLocalRepositoryArtifactInput
): InMemoryContextArtifactShape {
  const orientationArtifacts = prepareLocalCompressionArtifacts({
    repositories: input.compressionRepositories,
    projectId: input.projectId,
    snapshotId: input.snapshot.snapshotId,
    worktreeStateId: input.worktreeStateId,
    snapshot: input.snapshot,
    sourceExcerpts: input.sourceExcerpts,
    symbolNodes: input.symbolNodes,
    symbolEdges: input.symbolEdges,
    now: input.now
  });
  const baseArtifact = compileArtifact(input, orientationArtifacts);
  const contextPackSummary = prepareLocalContextPackSummaryCompressionArtifact({
    repositories: input.compressionRepositories,
    projectId: input.projectId,
    snapshotId: input.snapshot.snapshotId,
    worktreeStateId: input.worktreeStateId,
    snapshot: input.snapshot,
    sessionId: input.sessionId,
    sentItems: listCurrentContextPackSummarySentItems({
      repositories: input.repositories,
      sessionId: input.sessionId,
      branch: input.snapshot.branch,
      commit: input.snapshot.commit,
      artifact: baseArtifact
    }),
    now: input.now
  });
  return compileArtifact(input, [
    ...orientationArtifacts,
    ...(contextPackSummary ? [contextPackSummary] : [])
  ]);
}

function compileArtifact(
  input: CompileLocalRepositoryArtifactInput,
  compressionArtifacts: readonly RepositoryArtifactCompressionInput[]
): InMemoryContextArtifactShape {
  return compileRepositoryContextArtifact({
    projectId: input.projectId,
    sessionId: input.sessionId,
    taskId: input.taskId,
    taskType: input.taskType,
    riskOverlays: input.riskOverlays,
    userRequestHash: input.userRequestHash,
    snapshot: input.snapshot,
    worktreeStateId: input.worktreeStateId,
    sources: input.sources,
    sourceExcerpts: input.sourceExcerpts,
    symbolNodes: input.symbolNodes,
    symbolEdges: input.symbolEdges,
    activeClaims: input.activeClaims,
    compressionArtifacts,
    taskRetrieval: input.taskRetrieval,
    createdAt: input.now
  });
}
