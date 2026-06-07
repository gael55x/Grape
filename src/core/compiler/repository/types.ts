import type { ContextScopeShape, RiskOverlay, SourceType, TaskType } from "../../../shared/index.js";

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

export interface RepositoryArtifactSourceExcerptInput {
  readonly proofId: string;
  readonly sourceId: string;
  readonly sourceType: SourceType;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: "committed" | "staged" | "unstaged" | "untracked" | "external";
  readonly excerpt: string;
  readonly excerptHash: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly truncated: boolean;
}

export interface RepositoryArtifactSymbolNodeInput {
  readonly symbolId: string;
  readonly sourceId: string;
  readonly path: string;
  readonly language: string;
  readonly name: string;
  readonly symbolKind: string;
  readonly startLine?: number;
  readonly endLine?: number;
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

export interface RepositoryArtifactTaskRetrievalInput {
  readonly selectedSourceRefs: readonly string[];
  readonly explicitSourceRefs: readonly string[];
  readonly testSourceRefs: readonly string[];
  readonly relatedTestSourceRefs: readonly string[];
  readonly relatedTestRelationships: readonly RepositoryArtifactRelatedTestRelationshipInput[];
  readonly graphSourceRefs: readonly string[];
  readonly symbolSourceRefs: readonly string[];
  readonly lexicalSourceRefs: readonly string[];
  readonly sourceAnchors?: readonly RepositoryArtifactSourceAnchorInput[];
  readonly queryTerms: readonly string[];
  readonly warnings: readonly string[];
}

export interface RepositoryArtifactRelatedTestRelationshipInput {
  readonly relationshipRef?: string;
  readonly testSourceRef: string;
  readonly targetSourceRef: string;
  readonly relationship: "imports" | "calls";
}

export interface RepositoryArtifactSourceAnchorInput {
  readonly sourceRef: string;
  readonly reason: "symbol_match";
  readonly label: string;
  readonly startLine: number;
  readonly endLine: number;
}

export interface RepositoryArtifactActiveClaimInput {
  readonly claimId: string;
  readonly claimType: string;
  readonly claimText: string;
  readonly scopeHash: string;
  readonly sourceRefs: readonly string[];
  readonly proofRefs: readonly string[];
}

export interface RepositoryArtifactCompressionInput {
  readonly compressionId: string;
  readonly type: "symbol_outline" | "rule_digest" | "context_pack_summary";
  readonly summaryText: string;
  readonly inputRefs: readonly string[];
  readonly inputHashes: readonly string[];
  readonly inputHash: string;
  readonly policyHash: string;
  readonly scopeHash: string;
  readonly outputHash: string;
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
  readonly sourceExcerpts: readonly RepositoryArtifactSourceExcerptInput[];
  readonly symbolNodes: readonly RepositoryArtifactSymbolNodeInput[];
  readonly symbolEdges: readonly RepositoryArtifactSymbolEdgeInput[];
  readonly activeClaims?: readonly RepositoryArtifactActiveClaimInput[];
  readonly compressionArtifacts?: readonly RepositoryArtifactCompressionInput[];
  readonly taskRetrieval?: RepositoryArtifactTaskRetrievalInput;
  readonly currentScope?: ContextScopeShape;
  readonly currentScopeWarnings?: readonly string[];
  readonly createdAt: string;
}
