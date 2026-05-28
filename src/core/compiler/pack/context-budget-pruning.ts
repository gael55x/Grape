import type {
  ContextPackItemShape,
  InMemoryContextArtifactShape,
  InMemoryContextPackItemShape,
  InMemoryContextSectionShape
} from "../../../shared/index.js";
import { evaluateContextPackBudget } from "./context-budget.js";
import type { ContextBudgetOmittedItem, ContextPackBudgetResult } from "./context-budget.js";

export interface InMemoryContextPackBudgetInput {
  readonly tokenBudget?: number;
  readonly artifact: InMemoryContextArtifactShape;
  readonly contextPackItems: readonly InMemoryContextPackItemShape[];
}

export interface InMemoryContextPackBudgetResult {
  readonly contextPackItems: readonly InMemoryContextPackItemShape[];
  readonly budget: ContextPackBudgetResult;
}

export function applyInMemoryContextPackBudget(
  input: InMemoryContextPackBudgetInput
): InMemoryContextPackBudgetResult {
  const sectionsById = new Map(input.artifact.sections.map((section) => [section.id, section]));
  const requiredItems = input.contextPackItems.filter((item) =>
    isRequiredInMemoryContext(item, sectionsById.get(item.sectionId))
  );
  const requiredContextTokens = sumInMemoryItemTokens(requiredItems);

  if (input.tokenBudget === undefined || requiredContextTokens > input.tokenBudget) {
    return {
      contextPackItems: input.contextPackItems,
      budget: evaluateContextPackBudget({
        tokenBudget: input.tokenBudget,
        contextPackItems: toBudgetPackItems(input.contextPackItems, sectionsById),
        estimatedPackTokens: sumInMemoryItemTokens(input.contextPackItems)
      })
    };
  }

  const selectedIds = new Set(requiredItems.map((item) => item.itemId));
  let selectedOptionalTokens = 0;

  for (const item of optionalItemsByKeepPriority(input.contextPackItems, sectionsById)) {
    const itemTokens = estimateInMemoryPackItemTokens(item);
    if (requiredContextTokens + selectedOptionalTokens + itemTokens <= input.tokenBudget) {
      selectedIds.add(item.itemId);
      selectedOptionalTokens += itemTokens;
    }
  }

  const contextPackItems = input.contextPackItems.filter((item) => selectedIds.has(item.itemId));
  const omittedDueToBudget = input.contextPackItems
    .filter((item) => !selectedIds.has(item.itemId))
    .map((item) => toBudgetOmittedItem(item, sectionsById.get(item.sectionId)));

  return {
    contextPackItems,
    budget: evaluateContextPackBudget({
      tokenBudget: input.tokenBudget,
      contextPackItems: toBudgetPackItems(contextPackItems, sectionsById),
      estimatedPackTokens: sumInMemoryItemTokens(contextPackItems),
      omittedDueToBudget
    })
  };
}

function optionalItemsByKeepPriority(
  items: readonly InMemoryContextPackItemShape[],
  sectionsById: ReadonlyMap<string, InMemoryContextSectionShape>
): readonly InMemoryContextPackItemShape[] {
  return items
    .filter((item) => !isRequiredInMemoryContext(item, sectionsById.get(item.sectionId)))
    .map((item, index) => ({ item, index, priority: keepPriorityForSection(sectionsById.get(item.sectionId)) }))
    .sort((left, right) => right.priority - left.priority || left.index - right.index)
    .map(({ item }) => item);
}

function isRequiredInMemoryContext(
  item: InMemoryContextPackItemShape,
  section: InMemoryContextSectionShape | undefined
): boolean {
  return (
    item.pinned ||
    item.state === "INVALIDATE_PREVIOUS" ||
    item.state === "OMIT_UNCHANGED" ||
    item.state === "RESTORE_AVAILABLE" ||
    section?.id === "task" ||
    Boolean(section?.exactRequired) ||
    Boolean(section && isSafetyCriticalSection(section))
  );
}

function isSafetyCriticalSection(section: InMemoryContextSectionShape): boolean {
  return section.type === "risk_warning" || section.type === "stale_warning" || section.type === "contradiction";
}

function keepPriorityForSection(section: InMemoryContextSectionShape | undefined): number {
  if (!section) return 0;
  if (section.type === "code_span" || section.type === "test_span" || section.type === "config_span") return 80;
  if (section.id === "task") return 70;
  if (section.id === "task-retrieval") return 60;
  if (section.id === "source-manifest" || section.id === "symbol-summary") return 30;
  if (section.type === "compression_orientation") return 20;
  return 50;
}

function toBudgetPackItems(
  items: readonly InMemoryContextPackItemShape[],
  sectionsById: ReadonlyMap<string, InMemoryContextSectionShape>
): readonly ContextPackItemShape[] {
  return items.map((item) => {
    const section = sectionsById.get(item.sectionId);
    return {
      id: item.itemId,
      state: item.state,
      itemKind: itemKindForSection(item, section),
      itemRef: item.previousItemId ?? section?.sourceRefs[0] ?? section?.proofRefs[0] ?? item.sectionId,
      sectionId: item.sectionId,
      title: item.title,
      content: item.body,
      contentHash: item.contentHash,
      tokenCount: estimateInMemoryPackItemTokens(item),
      pinned: item.pinned,
      safetyCritical: isRequiredInMemoryContext(item, section),
      invalidatesSentItemId: item.state === "INVALIDATE_PREVIOUS" ? item.previousItemId : undefined,
      restoreId: item.restoreToken,
      inputRefs: [],
      warnings: item.warnings
    };
  });
}

function toBudgetOmittedItem(
  item: InMemoryContextPackItemShape,
  section: InMemoryContextSectionShape | undefined
): ContextBudgetOmittedItem {
  return {
    id: item.itemId,
    itemKind: itemKindForSection(item, section),
    itemRef: section?.sourceRefs[0] ?? section?.proofRefs[0] ?? item.sectionId,
    itemHash: item.contentHash,
    sectionId: item.sectionId,
    tokenCount: estimateInMemoryPackItemTokens(item),
    canRestore: false
  };
}

function itemKindForSection(
  item: InMemoryContextPackItemShape,
  section: InMemoryContextSectionShape | undefined
): ContextPackItemShape["itemKind"] {
  if (item.state === "INVALIDATE_PREVIOUS") return "invalidation";
  if (item.state === "RESTORE_AVAILABLE") return "restore_hint";
  if (!section) return "context_summary";

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

function sumInMemoryItemTokens(items: readonly InMemoryContextPackItemShape[]): number {
  return items.reduce((total, item) => total + estimateInMemoryPackItemTokens(item), 0);
}

function estimateInMemoryPackItemTokens(item: InMemoryContextPackItemShape): number {
  const text = [
    item.state,
    item.title,
    item.body,
    item.restoreToken ?? "",
    item.safeOmissionReason ?? "",
    ...item.warnings
  ].join("\n");
  const normalized = text.trim();
  return normalized.length === 0 ? 0 : Math.ceil(normalized.length / 4);
}
