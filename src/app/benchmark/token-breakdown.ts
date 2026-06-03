import type { ContextPackItemShape } from "../../shared/index.js";

export interface BenchmarkStateTokenBreakdown {
  readonly state: string;
  readonly itemCount: number;
  readonly bodyTokens: number;
  readonly serializedTokens: number;
}

export interface BenchmarkSectionTokenBreakdown {
  readonly sectionId: string;
  readonly state: string;
  readonly itemKind: string;
  readonly itemRef: string;
  readonly bodyTokens: number;
  readonly serializedTokens: number;
}

export interface BenchmarkTokenBreakdown {
  readonly serializedPackTokens: number;
  readonly byState: readonly BenchmarkStateTokenBreakdown[];
  readonly bySection: readonly BenchmarkSectionTokenBreakdown[];
}

export function buildBenchmarkTokenBreakdown(
  items: readonly ContextPackItemShape[]
): BenchmarkTokenBreakdown {
  const stateBreakdown = new Map<string, MutableStateTokenBreakdown>();
  const sectionBreakdown = new Map<string, MutableSectionTokenBreakdown>();

  let serializedPackTokens = 0;
  for (const item of items) {
    const serializedTokens = estimateSerializedTokens(item);
    serializedPackTokens += serializedTokens;

    const state = stateBreakdown.get(item.state) ?? {
      state: item.state,
      itemCount: 0,
      bodyTokens: 0,
      serializedTokens: 0
    };
    state.itemCount += 1;
    state.bodyTokens += item.tokenCount;
    state.serializedTokens += serializedTokens;
    stateBreakdown.set(item.state, state);

    const sectionId = item.sectionId ?? "none";
    const sectionKey = `${sectionId}\u0000${item.state}\u0000${item.itemKind}\u0000${item.itemRef}`;
    const section = sectionBreakdown.get(sectionKey) ?? {
      sectionId,
      state: item.state,
      itemKind: item.itemKind,
      itemRef: item.itemRef,
      bodyTokens: 0,
      serializedTokens: 0
    };
    section.bodyTokens += item.tokenCount;
    section.serializedTokens += serializedTokens;
    sectionBreakdown.set(sectionKey, section);
  }

  return {
    serializedPackTokens,
    byState: [...stateBreakdown.values()].sort((left, right) => left.state.localeCompare(right.state)),
    bySection: [...sectionBreakdown.values()].sort(compareSectionBreakdowns)
  };
}

export function firstTurnOverheadPercent(naiveTokens: number, grapeTokens: number): number {
  if (naiveTokens <= 0) return 0;
  return roundPercent(Math.max(0, ((grapeTokens - naiveTokens) / naiveTokens) * 100));
}

function estimateSerializedTokens(value: unknown): number {
  return Math.ceil(Buffer.byteLength(JSON.stringify(value), "utf8") / 4);
}

function compareSectionBreakdowns(
  left: BenchmarkSectionTokenBreakdown,
  right: BenchmarkSectionTokenBreakdown
): number {
  return (
    left.sectionId.localeCompare(right.sectionId) ||
    left.state.localeCompare(right.state) ||
    left.itemKind.localeCompare(right.itemKind) ||
    left.itemRef.localeCompare(right.itemRef)
  );
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

interface MutableStateTokenBreakdown {
  state: string;
  itemCount: number;
  bodyTokens: number;
  serializedTokens: number;
}

interface MutableSectionTokenBreakdown {
  sectionId: string;
  state: string;
  itemKind: string;
  itemRef: string;
  bodyTokens: number;
  serializedTokens: number;
}
