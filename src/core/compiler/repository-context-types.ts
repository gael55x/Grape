import type { RiskOverlay, SourceType, TaskType } from "../../shared/index.js";

export interface RepositoryArtifactSnapshotInput {
  readonly snapshotId: string;
  readonly repoId: string;
  readonly branch: string;
  readonly commit: string;
  readonly worktreeStatus: "clean" | "dirty" | "unknown";
  readonly worktreeHash: string;
  readonly snapshotHash: string;
  readonly dirtyPaths: readonly string[];
}

export interface RepositoryArtifactSourceInput {
  readonly sourceId: string;
  readonly sourceType: SourceType;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: "committed" | "staged" | "unstaged" | "untracked" | "external";
  readonly trustClass: "trusted" | "temporary" | "untrusted";
  readonly privacyStatus: "allowed" | "ignored" | "private" | "blocked_secret";
  readonly redactionStatus: "not_needed" | "redacted" | "blocked";
}

export interface RepositoryArtifactSymbolNodeInput {
  readonly symbolId: string;
  readonly sourceId: string;
  readonly path: string;
  readonly language: string;
  readonly name: string;
  readonly symbolKind: string;
  readonly bodyHash?: string;
  readonly signatureHash?: string;
  readonly confidence: "high" | "medium" | "low";
}

export interface RepositoryArtifactSymbolEdgeInput {
  readonly edgeId: string;
  readonly fromSymbolId: string;
  readonly toSymbolId?: string;
  readonly toRef?: string;
  readonly edgeType: string;
  readonly confidence: "high" | "medium" | "low";
  readonly discoveryMethod: string;
}

export interface CompileRepositoryContextArtifactInput {
  readonly projectId: string;
  readonly sessionId: string;
  readonly taskId: string;
  readonly taskType: TaskType;
  readonly riskOverlays: readonly RiskOverlay[];
  readonly userRequestHash: string;
  readonly snapshot: RepositoryArtifactSnapshotInput;
  readonly worktreeStateId: string;
  readonly sources: readonly RepositoryArtifactSourceInput[];
  readonly symbolNodes: readonly RepositoryArtifactSymbolNodeInput[];
  readonly symbolEdges: readonly RepositoryArtifactSymbolEdgeInput[];
  readonly createdAt: string;
}
