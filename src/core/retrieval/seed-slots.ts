export const TEST_SEED_DEFAULT_MAX_RATIO = 0.25;
export const TEST_SEED_FOCUSED_MAX_RATIO = 0.5;
export const TEST_SEED_ABSOLUTE_MAX = 4;

export type RetrievalTaskKind = "default" | "test_focused";

export interface ComputeReservedSeedSlotsInput {
  readonly maxSelectedSources: number;
  readonly testSeedCount: number;
  readonly taskKind: RetrievalTaskKind;
}

export interface ReservedSeedSlots {
  readonly maxExplicitSourceSlots: number;
  readonly maxTestSeedSlots: number;
}

export function computeReservedSeedSlots(input: ComputeReservedSeedSlotsInput): ReservedSeedSlots {
  const maxExplicitSourceSlots = input.maxSelectedSources;

  if (input.testSeedCount === 0 || input.maxSelectedSources === 0) {
    return {
      maxExplicitSourceSlots,
      maxTestSeedSlots: 0
    };
  }

  const ratio =
    input.taskKind === "test_focused" ? TEST_SEED_FOCUSED_MAX_RATIO : TEST_SEED_DEFAULT_MAX_RATIO;
  const ratioSlots = Math.max(1, Math.floor(input.maxSelectedSources * ratio));
  const maxTestSeedSlots = Math.min(
    ratioSlots,
    TEST_SEED_ABSOLUTE_MAX,
    input.maxSelectedSources,
    input.testSeedCount
  );

  return {
    maxExplicitSourceSlots,
    maxTestSeedSlots
  };
}

export function inferRetrievalTaskKind(input: {
  readonly seedTests?: readonly string[];
  readonly seedFiles?: readonly string[];
  readonly task: string;
}): RetrievalTaskKind {
  const pathLikeTestSeeds = (input.seedTests ?? []).filter(isPathLikeTestSeed);
  const hasExplicitSeed = (input.seedFiles ?? []).length > 0;

  if (pathLikeTestSeeds.length > 0 && !hasExplicitSeed) {
    return "test_focused";
  }

  const normalizedTask = input.task.toLowerCase();
  if (
    pathLikeTestSeeds.length > 0 &&
    /\b(test|tests|spec|failure|failing|regression|e2e)\b/.test(normalizedTask)
  ) {
    return "test_focused";
  }

  return "default";
}

export function isPathLikeTestSeed(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.includes("/") || trimmed.includes("\\")) return true;
  return /\.(test|spec|e2e)\.[A-Za-z0-9]+$/.test(trimmed);
}
