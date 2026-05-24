import type {
  InMemoryContextPackItemShape,
  InMemoryContextSectionShape
} from "../../shared/index.js";

export interface InMemoryTokenAccountingInput {
  fixture: string;
  taskId: string;
  turn: number;
  selectedSections: readonly InMemoryContextSectionShape[];
  contextPackItems: readonly InMemoryContextPackItemShape[];
  unsafeOmissions: number;
  staleItemsSent?: number;
}

export interface InMemoryTokenSavingsMetric {
  fixture: string;
  taskId: string;
  turn: number;
  naiveTokens: number;
  grapeTokens: number;
  omittedUnchangedTokens: number;
  compressionSavedTokens: 0;
  pinnedOverheadTokens: number;
  invalidationOverheadTokens: number;
  unsafeOmissions: number;
  staleItemsSent: number;
  reductionPercent: number;
}

export function calculateInMemoryTokenSavings(
  input: InMemoryTokenAccountingInput
): InMemoryTokenSavingsMetric {
  const naiveTokens = input.selectedSections.reduce(
    (total, section) => total + estimateTextTokens(renderNaiveSection(section)),
    0
  );
  const grapeTokens = input.contextPackItems.reduce(
    (total, item) => total + estimateTextTokens(renderPackItemForEstimate(item)),
    0
  );
  const omittedUnchangedTokens = calculateOmittedUnchangedTokens(input);
  const pinnedOverheadTokens = input.contextPackItems
    .filter((item) => item.state === "PINNED")
    .reduce((total, item) => total + estimateTextTokens(renderPackItemForEstimate(item)), 0);
  const invalidationOverheadTokens = input.contextPackItems
    .filter((item) => item.state === "INVALIDATE_PREVIOUS")
    .reduce((total, item) => total + estimateTextTokens(renderPackItemForEstimate(item)), 0);

  return {
    fixture: input.fixture,
    taskId: input.taskId,
    turn: input.turn,
    naiveTokens,
    grapeTokens,
    omittedUnchangedTokens,
    compressionSavedTokens: 0,
    pinnedOverheadTokens,
    invalidationOverheadTokens,
    unsafeOmissions: input.unsafeOmissions,
    staleItemsSent: input.staleItemsSent ?? 0,
    reductionPercent: calculateReductionPercent(naiveTokens, grapeTokens)
  };
}

function calculateOmittedUnchangedTokens(input: InMemoryTokenAccountingInput): number {
  const sectionsById = new Map(input.selectedSections.map((section) => [section.id, section]));
  const omittedSectionIds = new Set(
    input.contextPackItems
      .filter((item) => item.state === "OMIT_UNCHANGED")
      .map((item) => item.sectionId)
  );

  let total = 0;
  for (const sectionId of omittedSectionIds) {
    const section = sectionsById.get(sectionId);
    if (section) {
      total += estimateTextTokens(renderNaiveSection(section));
    }
  }

  return total;
}

function renderNaiveSection(section: InMemoryContextSectionShape): string {
  return `${section.type}\n${section.title}\n${section.body}`;
}

function renderPackItemForEstimate(item: InMemoryContextPackItemShape): string {
  return [
    item.state,
    item.title,
    item.body,
    item.restoreToken ?? "",
    item.safeOmissionReason ?? "",
    ...item.warnings
  ].join("\n");
}

function calculateReductionPercent(naiveTokens: number, grapeTokens: number): number {
  if (naiveTokens === 0) {
    return 0;
  }

  return Math.max(0, Math.round(((naiveTokens - grapeTokens) / naiveTokens) * 10000) / 100);
}

function estimateTextTokens(text: string): number {
  const normalized = text.trim();
  if (normalized.length === 0) {
    return 0;
  }

  return Math.ceil(normalized.length / 4);
}
