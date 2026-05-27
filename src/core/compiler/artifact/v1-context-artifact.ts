import type {
  CompileMode,
  ContextArtifactShape,
  InMemoryContextArtifactShape
} from "../../../shared/index.js";
import type { ContextPackBudgetResult } from "../pack/context-budget.js";
import { hashStableJson } from "../repository/hash.js";
import {
  compressionArtifactRefs,
  requiredDependencyIds,
  toContextDependency,
  toContextInput
} from "./v1-dependencies.js";
import { confidenceFor, graphConfidenceFor, missingContextFor } from "./v1-quality.js";
import { toContextSection } from "./v1-sections.js";

export interface V1ContextArtifactInput {
  readonly artifact: InMemoryContextArtifactShape;
  readonly projectId: string;
  readonly repoSnapshotId: string;
  readonly worktreeStateId: string;
  readonly dirtyWorktree: boolean;
  readonly budget: ContextPackBudgetResult;
  readonly tokenCost: number;
  readonly environmentScope?: ContextArtifactShape["environmentScope"];
}

export function buildV1ContextArtifact(input: V1ContextArtifactInput): ContextArtifactShape {
  const requiredIds = requiredDependencyIds(input.artifact.sections);
  const dependencies = input.artifact.dependencyManifest.dependencies.map((dependency) =>
    toContextDependency(input.artifact, dependency, requiredIds)
  );
  const sections = input.artifact.sections.map((section) =>
    toContextSection(input.artifact, section, dependencies)
  );
  const warnings = [...input.artifact.warnings, ...input.budget.warnings];
  const unsafeReasons = [...input.artifact.unsafeReasons, ...input.budget.unsafeReasons];
  const withoutHash = {
    id: input.artifact.artifactId,
    projectId: input.projectId,
    repoId: input.artifact.input.repoId,
    repoSnapshotId: input.repoSnapshotId,
    worktreeStateId: input.worktreeStateId,
    sessionId: input.artifact.input.sessionId,
    taskId: input.artifact.input.taskId,
    artifactFormatVersion: 1 as const,
    taskType: input.artifact.input.taskType,
    compileMode: compileModeForContextArtifact({ warnings, unsafeReasons, budget: input.budget }),
    riskOverlays: input.artifact.input.riskOverlays,
    branch: input.artifact.input.branch,
    headCommit: input.artifact.input.commit,
    dirtyWorktree: input.dirtyWorktree,
    environmentScope: input.environmentScope ?? "local",
    inputRefs: dependencies.map(toContextInput),
    compressionArtifactRefs: compressionArtifactRefs(dependencies),
    outputSections: sections,
    compressionArtifactsUsed: compressionArtifactRefs(dependencies),
    dependencyManifest: {
      manifestVersion: 1,
      artifactId: input.artifact.artifactId,
      dependencies,
      inputHash: input.artifact.artifactHash,
      generatedAt: input.artifact.createdAt
    },
    confidence: confidenceFor(unsafeReasons, warnings),
    graphConfidence: graphConfidenceFor(warnings),
    impactCandidateSetTooLarge: false,
    missingContext: missingContextFor(unsafeReasons),
    unverifiedAssumptions: warnings,
    activeContradictions: sections
      .filter((section) => section.containsActiveContradiction)
      .map((section) => section.id),
    blindSpots: sections
      .filter((section) => section.type === "blind_spot" || section.containsMissingVerificationWarning)
      .map((section) => section.id),
    criticalBlindSpots: unsafeReasons,
    omittedRequired: unsafeReasons.includes("token_budget_below_required_context")
      ? ["required_context_exceeds_token_budget"]
      : [],
    omittedDueToBudget: [],
    tokenBudget: input.budget.tokenBudget,
    tokenCost: input.tokenCost,
    createdAt: input.artifact.createdAt
  };

  return {
    ...withoutHash,
    contentHash: hashStableJson(withoutHash)
  };
}

export function compileModeForContextArtifact(input: {
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
  readonly budget: ContextPackBudgetResult;
}): CompileMode {
  if (input.unsafeReasons.length > 0) return "cannot_compile_safely";
  if (input.budget.status === "required_context_exceeds_budget") return "cannot_compile_safely";
  if (input.budget.status === "over_budget") return "partial_with_risk";
  if (input.warnings.length > 0) return "partial_with_risk";
  return "safe_minimum";
}
