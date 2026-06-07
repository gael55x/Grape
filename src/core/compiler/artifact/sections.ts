import type {
  ContextDependencyShape,
  ContextSectionShape,
  ContextSectionType,
  InMemoryContextArtifactShape,
  InMemoryContextSectionShape
} from "../../../shared/index.js";

export function toContextSection(
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
    safetyCritical: section.pinned || section.exactRequired || isRepositorySectionSafetyCritical(section),
    requiresExactCode: section.exactRequired,
    canCompress: canCompressSection(section),
    containsActiveContradiction: section.type === "contradiction",
    containsStaleInvalidationWarning: section.type === "stale_warning",
    containsMissingVerificationWarning: section.id === "index-blind-spots" || section.type === "stale_warning",
    restoreable: !section.pinned && section.redactionStatus !== "blocked",
    restoreHint: !section.pinned ? section.id : undefined
  };
}

export function isRepositorySectionSafetyCritical(section: InMemoryContextSectionShape): boolean {
  return section.type === "risk_warning" || section.type === "stale_warning" || section.type === "contradiction";
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

function canCompressSection(section: InMemoryContextSectionShape): boolean {
  return !section.pinned && !section.exactRequired && !isRepositorySectionSafetyCritical(section);
}

function estimateTextTokens(text: string): number {
  const normalized = text.trim();
  return normalized.length === 0 ? 0 : Math.ceil(normalized.length / 4);
}
