import type { TaskSemanticCandidate } from "./semantic-candidates.js";
import { orderSourceRefsBySemanticCandidates } from "./semantic-candidates.js";
import type { ReservedSeedSlots } from "./seed-slots.js";
import { packageRootForSourceRef } from "../scope/package-root.js";
import { compareStableStrings } from "./stable-compare.js";

export type SelectionReason =
  | "explicit_seed"
  | "test_seed"
  | "related_test"
  | "graph_related"
  | "symbol_match"
  | "lexical_match";

type SelectionTier = "1a" | "1b" | "2" | "3";

export interface SelectTieredSourceRefsInput {
  readonly selectedReasons: ReadonlyMap<string, ReadonlySet<SelectionReason>>;
  readonly maxSelectedSources: number;
  readonly semanticCandidates: readonly TaskSemanticCandidate[];
  readonly reservedSlots: ReservedSeedSlots;
}

export interface TieredSourceSelectionResult {
  readonly selectedSourceRefs: readonly string[];
  readonly omittedWarnings: readonly string[];
}

export function selectTieredSourceRefs(input: SelectTieredSourceRefsInput): TieredSourceSelectionResult {
  const allCandidateRefs = [...input.selectedReasons.keys()];
  if (allCandidateRefs.length === 0) {
    return { selectedSourceRefs: [], omittedWarnings: [] };
  }

  const tiers = partitionByTier(input.selectedReasons);
  const rankedTier1a = rankTierRefs(tiers.tier1a, input.semanticCandidates);
  const rankedTier1b = rankTierRefs(tiers.tier1b, input.semanticCandidates);
  const rankedTier2 = rankTierRefs(tiers.tier2, input.semanticCandidates);
  const rankedTier3 = spreadRankedPackageRefs(rankTierRefs(tiers.tier3, input.semanticCandidates));

  const selected: string[] = [];
  const selectedSet = new Set<string>();

  takeFromTier(
    selected,
    selectedSet,
    rankedTier1a,
    Math.min(input.reservedSlots.maxExplicitSourceSlots, input.maxSelectedSources)
  );
  takeFromTier(
    selected,
    selectedSet,
    rankedTier1b,
    Math.min(input.reservedSlots.maxTestSeedSlots, remainingSlots(selected, input.maxSelectedSources))
  );
  takeFromTier(
    selected,
    selectedSet,
    rankedTier2,
    remainingSlots(selected, input.maxSelectedSources)
  );
  takeFromTier(
    selected,
    selectedSet,
    rankedTier3,
    remainingSlots(selected, input.maxSelectedSources)
  );

  const omittedWarnings = buildOmittedWarnings(allCandidateRefs, selectedSet);

  return {
    selectedSourceRefs: selected,
    omittedWarnings
  };
}

export function filterSemanticCandidatesToSelected(
  candidates: readonly TaskSemanticCandidate[],
  selectedSourceRefs: readonly string[]
): readonly TaskSemanticCandidate[] {
  const selected = new Set(selectedSourceRefs);
  return candidates.filter((candidate) => selected.has(candidate.sourceRef));
}

export function countTier1bRefs(
  selectedReasons: ReadonlyMap<string, ReadonlySet<SelectionReason>>
): number {
  return [...selectedReasons.entries()].filter(
    ([, reasons]) => reasons.has("test_seed") && !reasons.has("explicit_seed")
  ).length;
}

function partitionByTier(selectedReasons: ReadonlyMap<string, ReadonlySet<SelectionReason>>): {
  readonly tier1a: readonly string[];
  readonly tier1b: readonly string[];
  readonly tier2: readonly string[];
  readonly tier3: readonly string[];
} {
  const tier1a: string[] = [];
  const tier1b: string[] = [];
  const tier2: string[] = [];
  const tier3: string[] = [];

  for (const [sourceRef, reasons] of selectedReasons) {
    switch (strongestTier(reasons)) {
      case "1a":
        tier1a.push(sourceRef);
        break;
      case "1b":
        tier1b.push(sourceRef);
        break;
      case "2":
        tier2.push(sourceRef);
        break;
      case "3":
        tier3.push(sourceRef);
        break;
    }
  }

  return { tier1a, tier1b, tier2, tier3 };
}

function strongestTier(reasons: ReadonlySet<SelectionReason>): SelectionTier {
  if (reasons.has("explicit_seed")) return "1a";
  if (reasons.has("test_seed")) return "1b";
  if (reasons.has("symbol_match") || reasons.has("related_test")) return "2";
  return "3";
}

function rankTierRefs(
  tierRefs: readonly string[],
  semanticCandidates: readonly TaskSemanticCandidate[]
): readonly string[] {
  if (tierRefs.length <= 1) return [...tierRefs];
  return orderSourceRefsBySemanticCandidates(tierRefs, semanticCandidates);
}

function takeFromTier(
  selected: string[],
  selectedSet: Set<string>,
  rankedRefs: readonly string[],
  maxToTake: number
): void {
  if (maxToTake <= 0) return;

  let taken = 0;
  for (const sourceRef of rankedRefs) {
    if (taken >= maxToTake) break;
    if (selectedSet.has(sourceRef)) continue;
    selected.push(sourceRef);
    selectedSet.add(sourceRef);
    taken += 1;
  }
}

interface RankedPackageGroup {
  readonly key: string;
  readonly firstIndex: number;
  readonly refs: readonly string[];
}

function spreadRankedPackageRefs(rankedRefs: readonly string[]): readonly string[] {
  if (rankedRefs.length <= 1) return [...rankedRefs];
  const packageRoots = new Set(
    rankedRefs
      .map(packageRootForSourceRef)
      .filter((root): root is string => Boolean(root))
  );
  if (packageRoots.size < 2) return [...rankedRefs];

  const groups = new Map<string, { firstIndex: number; refs: string[] }>();
  for (const [index, sourceRef] of rankedRefs.entries()) {
    const key = packageRootForSourceRef(sourceRef) ?? "";
    const group = groups.get(key) ?? { firstIndex: index, refs: [] };
    group.refs.push(sourceRef);
    groups.set(key, group);
  }

  const orderedGroups: readonly RankedPackageGroup[] = [...groups.entries()]
    .map(([key, group]) => ({ key, firstIndex: group.firstIndex, refs: group.refs }))
    .sort((left, right) => {
      if (left.firstIndex !== right.firstIndex) return left.firstIndex - right.firstIndex;
      return compareStableStrings(left.key, right.key);
    });

  const spread: string[] = [];
  let offset = 0;
  while (spread.length < rankedRefs.length) {
    let added = false;
    for (const group of orderedGroups) {
      const sourceRef = group.refs[offset];
      if (!sourceRef) continue;
      spread.push(sourceRef);
      added = true;
    }
    if (!added) break;
    offset += 1;
  }

  return spread;
}

function remainingSlots(selected: readonly string[], maxSelectedSources: number): number {
  return Math.max(0, maxSelectedSources - selected.length);
}

function buildOmittedWarnings(
  allCandidateRefs: readonly string[],
  selectedSet: ReadonlySet<string>
): string[] {
  const omitted = allCandidateRefs.filter((sourceRef) => !selectedSet.has(sourceRef));
  if (omitted.length === 0) return [];
  return ["task_retrieval_truncated", `task_retrieval_omitted_over_cap:${omitted.length}`];
}
