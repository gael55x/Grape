import type {
  CompileMode,
  ContextArtifactShape,
  ContextScopeShape,
  InMemoryContextArtifactShape
} from "../../../shared/index.js";
import type { ContextPackBudgetResult } from "../pack/context-budget.js";
import { hashStableJson } from "../repository/hash.js";
import {
  compressionArtifactRefs,
  requiredDependencyIds,
  toContextDependency,
  toContextInput
} from "./dependencies.js";
import { confidenceFor, graphConfidenceFor, missingContextFor } from "./quality.js";
import { toContextSection } from "./sections.js";

export interface ContextArtifactBuildInput {
  readonly artifact: InMemoryContextArtifactShape;
  readonly projectId: string;
  readonly repoSnapshotId: string;
  readonly worktreeStateId: string;
  readonly dirtyWorktree: boolean;
  readonly budget: ContextPackBudgetResult;
  readonly tokenCost: number;
  readonly environmentScope?: ContextArtifactShape["environmentScope"];
  readonly currentScope?: ContextScopeShape;
}

export function buildContextArtifact(input: ContextArtifactBuildInput): ContextArtifactShape {
  const budgetOmittedSectionIds = new Set(
    input.budget.omittedDueToBudget
      .map((item) => item.sectionId)
      .filter((sectionId): sectionId is string => sectionId !== undefined)
  );
  const outputSourceSections = input.artifact.sections.filter((section) => !budgetOmittedSectionIds.has(section.id));
  const requiredIds = requiredDependencyIds(outputSourceSections);
  const dependencies = input.artifact.dependencyManifest.dependencies.map((dependency) =>
    toContextDependency(input.artifact, dependency, requiredIds)
  );
  const sections = outputSourceSections.map((section) =>
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
    currentScope: contextArtifactCurrentScope(input),
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
    retrievalConfidence: input.artifact.retrievalConfidence,
    impactCandidateSetTooLarge: false,
    missingContext: missingContextFor(unsafeReasons, input.artifact.retrievalConfidence),
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
    omittedDueToBudget: input.budget.omittedDueToBudget.map((item) => ({
      id: item.id,
      itemKind: item.itemKind,
      itemRef: item.itemRef,
      itemHash: item.itemHash,
      reasonOmitted: "budget" as const,
      canRestore: item.canRestore,
      restoreId: item.restoreId,
      restoreCommand: item.restoreId
        ? `grape omitted --session ${input.artifact.input.sessionId} --token ${item.restoreId}`
        : undefined
    })),
    tokenBudget: input.budget.tokenBudget,
    tokenCost: input.tokenCost,
    createdAt: input.artifact.createdAt
  };

  return {
    ...withoutHash,
    contentHash: hashStableJson(withoutHash)
  };
}

function contextArtifactCurrentScope(input: ContextArtifactBuildInput): ContextScopeShape {
  return {
    repoId: input.artifact.input.repoId,
    branch: input.artifact.input.branch,
    commit: input.artifact.input.commit,
    worktreeHash: input.artifact.input.worktreeHash,
    dirtyWorktree: input.dirtyWorktree,
    taskId: input.artifact.input.taskId,
    sessionId: input.artifact.input.sessionId,
    environment: input.environmentScope ?? input.artifact.input.environmentScope ?? "local",
    packageRoot: input.artifact.input.packageRoot,
    serviceRoot: input.artifact.input.serviceRoot,
    featureFlagCount: input.artifact.input.featureFlagCount ?? 0,
    featureFlagScopeHash: input.artifact.input.featureFlagScopeHash,
    ...(input.currentScope ?? {})
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
