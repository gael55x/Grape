import type { RiskOverlay, TaskType } from "./contracts.js";
import type { RetrievalConfidenceShape } from "./retrieval-confidence.js";

export const compileModes = [
  "safe_minimum",
  "partial_with_risk",
  "broad_context_required",
  "cannot_compile_safely"
] as const;

export type CompileMode = (typeof compileModes)[number];

export const contextInputKinds = [
  "source",
  "claim",
  "proof",
  "file",
  "rule",
  "symbol",
  "test",
  "config",
  "lockfile",
  "compression_artifact",
  "repo_snapshot",
  "worktree_state",
  "session_ledger"
] as const;

export type ContextInputKind = (typeof contextInputKinds)[number];

export const dependencyStrengths = [
  "direct",
  "symbol",
  "test",
  "rule",
  "config",
  "compression",
  "weak_related"
] as const;

export type DependencyStrength = (typeof dependencyStrengths)[number];

export type ContextDependencyInvalidationTarget =
  | "claim"
  | "proof"
  | "section"
  | "artifact"
  | "compression_artifact"
  | "sent_item";

export const contextSectionTypes = [
  "task_summary",
  "repo_state",
  "rule",
  "claim",
  "proof",
  "code_span",
  "test",
  "config",
  "compression_summary",
  "symbol",
  "risk",
  "contradiction",
  "blind_spot",
  "open_question",
  "missing_context",
  "omitted_manifest",
  "diff_summary"
] as const;

export type ContextSectionType = (typeof contextSectionTypes)[number];

export type EnvironmentScope = "local" | "test" | "ci" | "staging" | "production" | "unknown";

export interface ContextScopeShape {
  readonly repoId: string;
  readonly serviceRoot?: string;
  readonly branch?: string;
  readonly commit?: string;
  readonly sourceScope?: "committed" | "staged" | "unstaged" | "untracked" | "external";
  readonly environment?: EnvironmentScope | "*";
  readonly featureFlag?: string;
  readonly path?: string;
  readonly symbol?: string;
  readonly route?: string;
  readonly test?: string;
  readonly taskId?: string;
  readonly sessionId?: string;
  readonly [key: string]: unknown;
}

export interface ContextInputShape {
  readonly id: string;
  readonly kind: ContextInputKind;
  readonly ref: string;
  readonly hash: string;
  readonly scope: ContextScopeShape;
  readonly dependencyStrength: DependencyStrength;
  readonly requiredForSafety: boolean;
}

export interface ContextSectionItemRefShape {
  readonly kind: ContextInputKind;
  readonly ref: string;
  readonly hash: string;
}

export interface ContextSectionShape {
  readonly id: string;
  readonly type: ContextSectionType;
  readonly title: string;
  readonly text: string;
  readonly itemRefs: readonly ContextSectionItemRefShape[];
  readonly riskOverlays: readonly RiskOverlay[];
  readonly tokenCount: number;
  readonly contentHash: string;
  readonly pinned: boolean;
  readonly safetyCritical: boolean;
  readonly requiresExactCode: boolean;
  readonly canCompress: boolean;
  readonly containsActiveContradiction: boolean;
  readonly containsStaleInvalidationWarning: boolean;
  readonly containsMissingVerificationWarning: boolean;
  readonly compressionArtifactId?: string;
  readonly restoreable: boolean;
  readonly restoreHint?: string;
}

export interface ContextDependencyShape {
  readonly id: string;
  readonly kind: ContextInputKind;
  readonly ref: string;
  readonly hash: string;
  readonly scope: ContextScopeShape;
  readonly strength: DependencyStrength;
  readonly requiredForSafety: boolean;
  readonly invalidates: readonly ContextDependencyInvalidationTarget[];
}

export interface ContextDependencyManifestShape {
  readonly manifestVersion: number;
  readonly artifactId: string;
  readonly dependencies: readonly ContextDependencyShape[];
  readonly inputHash: string;
  readonly generatedAt: string;
}

export interface OmittedDueToBudgetShape {
  readonly id: string;
  readonly itemKind: string;
  readonly itemRef: string;
  readonly itemHash: string;
  readonly reasonOmitted: "budget";
  readonly canRestore: boolean;
  readonly restoreId?: string;
  readonly restoreCommand?: string;
}

export interface ContextArtifactShape {
  readonly id: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly repoSnapshotId: string;
  readonly worktreeStateId: string;
  readonly sessionId: string;
  readonly taskId?: string;
  readonly artifactFormatVersion: 1;
  readonly taskType: TaskType;
  readonly compileMode: CompileMode;
  readonly riskOverlays: readonly RiskOverlay[];
  readonly branch: string;
  readonly headCommit: string;
  readonly dirtyWorktree: boolean;
  readonly currentScope: ContextScopeShape;
  readonly stagedDiffHash?: string;
  readonly unstagedDiffHash?: string;
  readonly untrackedRelevantFilesHash?: string;
  readonly environmentScope: EnvironmentScope;
  readonly inputRefs: readonly ContextInputShape[];
  readonly compressionArtifactRefs: readonly string[];
  readonly outputSections: readonly ContextSectionShape[];
  readonly compressionArtifactsUsed: readonly string[];
  readonly dependencyManifest: ContextDependencyManifestShape;
  readonly confidence: "high" | "medium" | "low";
  readonly graphConfidence: "high" | "medium" | "low" | "unknown";
  readonly retrievalConfidence?: RetrievalConfidenceShape;
  readonly impactCandidateSetTooLarge: boolean;
  readonly missingContext: readonly string[];
  readonly unverifiedAssumptions: readonly string[];
  readonly activeContradictions: readonly string[];
  readonly blindSpots: readonly string[];
  readonly criticalBlindSpots: readonly string[];
  readonly omittedRequired: readonly string[];
  readonly omittedDueToBudget: readonly OmittedDueToBudgetShape[];
  readonly tokenBudget?: number;
  readonly tokenCost: number;
  readonly contentHash: string;
  readonly createdAt: string;
  readonly invalidatedAt?: string;
  readonly invalidatedReason?: string;
}
