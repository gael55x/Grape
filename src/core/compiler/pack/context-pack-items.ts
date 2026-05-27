import type {
  ContextPackItemKind,
  ContextPackItemShape,
  InMemoryContextArtifactShape,
  InMemoryContextDependencyShape,
  InMemoryContextPackItemShape,
  InMemoryContextSectionShape
} from "../../../shared/index.js";

export function toContextPackItems(
  artifact: InMemoryContextArtifactShape,
  items: readonly InMemoryContextPackItemShape[]
): readonly ContextPackItemShape[] {
  return items.map((item) => toContextPackItem(artifact, item));
}

function toContextPackItem(
  artifact: InMemoryContextArtifactShape,
  item: InMemoryContextPackItemShape
): ContextPackItemShape {
  const section = artifact.sections.find((candidate) => candidate.id === item.sectionId);

  return {
    id: item.itemId,
    state: item.state,
    itemKind: itemKindForPackItem(item, section),
    itemRef: itemRefForPackItem(item, section),
    sectionId: item.sectionId,
    title: item.title,
    content: item.body,
    contentHash: item.contentHash,
    tokenCount: estimateTextTokens(item.body),
    pinned: item.pinned,
    safetyCritical: item.pinned || Boolean(section?.exactRequired) || item.state === "INVALIDATE_PREVIOUS",
    invalidatesSentItemId: item.state === "INVALIDATE_PREVIOUS" ? item.previousItemId : undefined,
    restoreId: item.restoreToken,
    inputRefs: inputRefsForItem(artifact, section),
    warnings: item.warnings
  };
}

function itemKindForPackItem(
  item: InMemoryContextPackItemShape,
  section: InMemoryContextSectionShape | undefined
): ContextPackItemKind {
  if (item.state === "INVALIDATE_PREVIOUS") return "invalidation";
  if (item.state === "RESTORE_AVAILABLE") return "restore_hint";
  return section ? itemKindForSection(section) : "context_summary";
}

function itemKindForSection(section: InMemoryContextSectionShape): ContextPackItemKind {
  switch (section.type) {
    case "pinned_rule":
      return "rule";
    case "active_claim":
      return "claim";
    case "code_span":
    case "config_span":
      return "code_span";
    case "test_span":
      return "test_output";
    case "compression_orientation":
      return "compression_artifact";
    default:
      return "context_summary";
  }
}

function itemRefForPackItem(
  item: InMemoryContextPackItemShape,
  section: InMemoryContextSectionShape | undefined
): string {
  if (item.state === "INVALIDATE_PREVIOUS" && item.previousItemId) return item.previousItemId;
  if (item.state === "RESTORE_AVAILABLE" && item.restoreToken) return item.restoreToken;
  return section ? itemRefForSection(section) : item.sectionId;
}

function itemRefForSection(section: InMemoryContextSectionShape): string {
  return section.sourceRefs[0] ?? section.proofRefs[0] ?? section.id;
}

function inputRefsForItem(
  artifact: InMemoryContextArtifactShape,
  section: InMemoryContextSectionShape | undefined
): ContextPackItemShape["inputRefs"] {
  const dependenciesById = new Map(
    artifact.dependencyManifest.dependencies.map((dependency) => [dependency.id, dependency])
  );
  const dependencyRefs = section?.dependencyRefs ?? artifact.dependencyManifest.dependencies.map((dependency) => dependency.id);

  return dependencyRefs
    .map((dependencyRef) => dependenciesById.get(dependencyRef))
    .filter((dependency): dependency is InMemoryContextDependencyShape => dependency !== undefined)
    .map((dependency) => ({
      id: dependency.id,
      kind: inputRefKindForDependency(dependency.kind),
      ref: dependency.ref,
      hash: dependency.hash,
      scope: dependency.scope
    }));
}

function inputRefKindForDependency(
  kind: InMemoryContextDependencyShape["kind"]
): ContextPackItemShape["inputRefs"][number]["kind"] {
  return kind === "source_file" ? "file" : kind;
}

function estimateTextTokens(text: string): number {
  const normalized = text.trim();
  return normalized.length === 0 ? 0 : Math.ceil(normalized.length / 4);
}
