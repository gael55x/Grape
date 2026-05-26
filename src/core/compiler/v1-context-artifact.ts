import type {
  CompileMode,
  ContextArtifactShape,
  ContextDependencyShape,
  ContextInputKind,
  ContextInputShape,
  ContextScopeShape,
  ContextSectionShape,
  ContextSectionType,
  DependencyStrength,
  InMemoryContextArtifactShape,
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../shared/index.js";
import type { ContextPackBudgetResult } from "./context-budget.js";
import { hashStableJson } from "./repository-context-hash.js";

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
  const requiredDependencyIds = requiredDependencies(input.artifact.sections);
  const dependencies = input.artifact.dependencyManifest.dependencies.map((dependency) =>
    toContextDependency(input.artifact, dependency, requiredDependencyIds)
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
    compressionArtifactRefs: [],
    outputSections: sections,
    compressionArtifactsUsed: [],
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

function requiredDependencies(sections: readonly InMemoryContextSectionShape[]): Set<string> {
  const required = new Set<string>();
  for (const section of sections) {
    if (!section.pinned && !section.exactRequired && !isSafetyWarning(section)) continue;
    for (const dependencyRef of section.dependencyRefs) required.add(dependencyRef);
  }
  return required;
}

function toContextDependency(
  artifact: InMemoryContextArtifactShape,
  dependency: InMemoryContextDependencyShape,
  requiredDependencyIds: ReadonlySet<string>
): ContextDependencyShape {
  const kind = contextInputKindForDependency(dependency.kind);
  return {
    id: dependency.id,
    kind,
    ref: dependency.ref,
    hash: dependency.hash,
    scope: contextScopeForDependency(artifact, dependency),
    strength: dependencyStrengthForKind(kind),
    requiredForSafety: requiredDependencyIds.has(dependency.id),
    invalidates: invalidationTargetsForKind(kind)
  };
}

function toContextInput(dependency: ContextDependencyShape): ContextInputShape {
  return {
    id: dependency.id,
    kind: dependency.kind,
    ref: dependency.ref,
    hash: dependency.hash,
    scope: dependency.scope,
    dependencyStrength: dependency.strength,
    requiredForSafety: dependency.requiredForSafety
  };
}

function toContextSection(
  artifact: InMemoryContextArtifactShape,
  section: InMemoryContextSectionShape,
  dependencies: readonly ContextDependencyShape[]
): ContextSectionShape {
  const dependenciesById = new Map(dependencies.map((dependency) => [dependency.id, dependency]));
  const itemRefs = section.dependencyRefs
    .map((dependencyRef) => dependenciesById.get(dependencyRef))
    .filter((dependency): dependency is ContextDependencyShape => dependency !== undefined)
    .map((dependency) => ({
      kind: dependency.kind,
      ref: dependency.ref,
      hash: dependency.hash
    }));

  return {
    id: section.id,
    type: contextSectionTypeFor(section),
    title: section.title,
    text: section.body,
    itemRefs,
    riskOverlays: artifact.input.riskOverlays,
    tokenCount: estimateTextTokens(section.body),
    contentHash: section.contentHash,
    pinned: section.pinned,
    safetyCritical: section.pinned || section.exactRequired || isSafetyWarning(section),
    requiresExactCode: section.exactRequired,
    canCompress: canCompressSection(section),
    containsActiveContradiction: section.type === "contradiction",
    containsStaleInvalidationWarning: section.type === "stale_warning",
    containsMissingVerificationWarning: section.id === "index-blind-spots" || section.type === "stale_warning",
    restoreable: !section.pinned && section.redactionStatus !== "blocked",
    restoreHint: !section.pinned ? section.id : undefined
  };
}

function contextInputKindForDependency(
  kind: InMemoryContextDependencyShape["kind"]
): ContextInputKind {
  switch (kind) {
    case "source_file":
      return "file";
    default:
      return kind;
  }
}

function contextSectionTypeFor(section: InMemoryContextSectionShape): ContextSectionType {
  if (section.id === "repo-state") return "repo_state";
  if (section.id === "index-blind-spots") return "blind_spot";
  if (section.id === "symbol-summary") return "symbol";
  if (section.id === "source-manifest") return "compression_summary";
  if (section.id === "task-retrieval") return "task_summary";

  switch (section.type) {
    case "task":
      return "task_summary";
    case "pinned_rule":
      return "rule";
    case "active_claim":
      return "claim";
    case "code_span":
      return "code_span";
    case "test_span":
      return "test";
    case "config_span":
      return "config";
    case "risk_warning":
    case "stale_warning":
      return "risk";
    case "contradiction":
      return "contradiction";
    case "compression_orientation":
      return "compression_summary";
    case "omission_notice":
      return "omitted_manifest";
  }
}

function contextScopeForDependency(
  artifact: InMemoryContextArtifactShape,
  dependency: InMemoryContextDependencyShape
): ContextScopeShape {
  return {
    repoId: artifact.input.repoId,
    branch: artifact.input.branch,
    commit: artifact.input.commit,
    taskId: artifact.input.taskId,
    sessionId: artifact.input.sessionId,
    ...dependency.scope
  };
}

function dependencyStrengthForKind(kind: ContextInputKind): DependencyStrength {
  switch (kind) {
    case "symbol":
      return "symbol";
    case "test":
      return "test";
    case "rule":
      return "rule";
    case "config":
    case "lockfile":
      return "config";
    case "compression_artifact":
      return "compression";
    default:
      return "direct";
  }
}

function invalidationTargetsForKind(
  kind: ContextInputKind
): readonly ContextDependencyShape["invalidates"][number][] {
  if (kind === "proof") return ["proof", "section", "artifact", "sent_item"];
  if (kind === "compression_artifact") return ["compression_artifact", "section", "artifact", "sent_item"];
  return ["section", "artifact", "sent_item"];
}

function canCompressSection(section: InMemoryContextSectionShape): boolean {
  return !section.pinned && !section.exactRequired && !isSafetyWarning(section);
}

function isSafetyWarning(section: InMemoryContextSectionShape): boolean {
  return section.type === "risk_warning" || section.type === "stale_warning" || section.type === "contradiction";
}

function confidenceFor(unsafeReasons: readonly string[], warnings: readonly string[]): "high" | "medium" | "low" {
  if (unsafeReasons.length > 0) return "low";
  if (warnings.length > 0) return "medium";
  return "high";
}

function graphConfidenceFor(warnings: readonly string[]): "high" | "medium" | "low" | "unknown" {
  return warnings.includes("repository_artifact_uses_lightweight_index") ? "low" : "medium";
}

function missingContextFor(unsafeReasons: readonly string[]): readonly string[] {
  return unsafeReasons.map((reason) => `missing:${reason}`);
}

function estimateTextTokens(text: string): number {
  const normalized = text.trim();
  return normalized.length === 0 ? 0 : Math.ceil(normalized.length / 4);
}
