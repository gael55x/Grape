import { benchmarkSessionId, runBenchmarkCompileTurn } from "./compile-turn.js";
import { prepareBenchmarkFixtureRepository } from "./fixture-repo.js";
import { collectBenchmarkFailures } from "./rules.js";
import type { TokenReductionBenchmarkInput, TokenReductionBenchmarkResult } from "./types.js";

const minSecondTurnReductionPercent = 30;
const maxFirstTurnOverheadPercent = 10;
const maxFirstTurnAgentOutputOverheadPercent = 400;
const maxSecondTurnStorageGrowthBytes = 5 * 1024 * 1024;

export function runTokenReductionBenchmark(
  input: TokenReductionBenchmarkInput
): TokenReductionBenchmarkResult {
  const prepared = prepareBenchmarkFixtureRepository({
    fixtureName: input.fixtureName,
    fixturePath: input.fixturePath,
    gitBinary: input.gitBinary,
    keepWorkspace: input.keepWorkspace
  });

  try {
    const sessionId = benchmarkSessionId(input.fixtureName, "tokens");
    const first = runBenchmarkCompileTurn({
      repoPath: prepared.repoPath,
      task: input.task,
      sessionId,
      turn: 1,
      now: input.now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir
    });
    const second = runBenchmarkCompileTurn({
      repoPath: prepared.repoPath,
      task: input.task,
      sessionId,
      turn: 2,
      now: input.now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir
    });
    const turns = [first, second];
    const failures = tokenReductionFailures(first, second);

    return {
      benchmark: "bench_token_reduction_after_first_turn",
      fixture: input.fixtureName,
      task: input.task,
      status: failures.length === 0 ? "pass" : "fail",
      workspacePath: input.keepWorkspace ? prepared.workspacePath : undefined,
      thresholds: {
        minSecondTurnReductionPercent,
        maxFirstTurnOverheadPercent,
        maxFirstTurnAgentOutputOverheadPercent,
        maxSecondTurnStorageGrowthBytes,
        requireZeroUnsafeOmissions: true,
        requireZeroStaleItemsSent: true,
        requireSecondTurnOmission: true,
        requireRestoreAvailable: true
      },
      turns,
      totals: totalsFor(turns),
      failures
    };
  } finally {
    prepared.cleanup();
  }
}

function tokenReductionFailures(
  firstTurn: {
    readonly overheadPercent: number;
    readonly agentOutputOverheadPercent: number;
    readonly storageFootprint: {
      readonly grapeBytes: number;
    };
  },
  secondTurn: {
    readonly reductionPercent: number;
    readonly unsafeOmissions: number;
    readonly staleItemsSent: number;
    readonly stateCounts: Record<string, number>;
    readonly restoreAvailableCount: number;
    readonly storageFootprint: {
      readonly grapeBytes: number;
    };
  }
): string[] {
  return collectBenchmarkFailures([
    ["first_turn_overhead_above_threshold", firstTurn.overheadPercent <= maxFirstTurnOverheadPercent],
    [
      "first_turn_agent_output_overhead_above_threshold",
      firstTurn.agentOutputOverheadPercent <= maxFirstTurnAgentOutputOverheadPercent
    ],
    ["second_turn_reduction_below_threshold", secondTurn.reductionPercent >= minSecondTurnReductionPercent],
    ["unsafe_omissions_present", secondTurn.unsafeOmissions === 0],
    ["stale_items_sent_present", secondTurn.staleItemsSent === 0],
    ["second_turn_missing_omit_unchanged", (secondTurn.stateCounts.OMIT_UNCHANGED ?? 0) > 0],
    ["second_turn_missing_restore_available", secondTurn.restoreAvailableCount > 0],
    [
      "second_turn_storage_growth_above_threshold",
      secondTurn.storageFootprint.grapeBytes - firstTurn.storageFootprint.grapeBytes <=
        maxSecondTurnStorageGrowthBytes
    ]
  ]);
}

function totalsFor(turns: readonly {
  readonly durationMs: number;
  readonly grapeTokens: number;
  readonly naiveTokens: number;
  readonly reductionPercent: number;
  readonly overheadPercent: number;
  readonly agentOutputOverheadPercent: number;
  readonly serializedPackTokens: number;
  readonly serializedAgentOutputTokens: number;
  readonly omittedUnchangedTokens: number;
  readonly pinnedOverheadTokens: number;
  readonly invalidationOverheadTokens: number;
  readonly invalidationItemCount: number;
  readonly restoreAvailableCount: number;
  readonly storageFootprint: {
    readonly grapeBytes: number;
  };
}[]): TokenReductionBenchmarkResult["totals"] {
  const [first, second] = turns;
  const secondTurnStorageGrowthBytes =
    second && first ? second.storageFootprint.grapeBytes - first.storageFootprint.grapeBytes : 0;
  return {
    wallClockMs: Math.round(turns.reduce((total, turn) => total + turn.durationMs, 0) * 100) / 100,
    firstTurnTokens: first?.grapeTokens ?? 0,
    firstTurnNaiveTokens: first?.naiveTokens ?? 0,
    firstTurnOverheadPercent: first?.overheadPercent ?? 0,
    secondTurnTokens: second?.grapeTokens ?? 0,
    secondTurnNaiveTokens: second?.naiveTokens ?? 0,
    secondTurnReductionPercent: second?.reductionPercent ?? 0,
    serializedPackTokens: turns.reduce((total, turn) => total + turn.serializedPackTokens, 0),
    serializedAgentOutputTokens: turns.reduce((total, turn) => total + turn.serializedAgentOutputTokens, 0),
    firstTurnAgentOutputOverheadPercent: first?.agentOutputOverheadPercent ?? 0,
    omittedUnchangedTokens: turns.reduce((total, turn) => total + turn.omittedUnchangedTokens, 0),
    pinnedOverheadTokens: turns.reduce((total, turn) => total + turn.pinnedOverheadTokens, 0),
    invalidationOverheadTokens: turns.reduce((total, turn) => total + turn.invalidationOverheadTokens, 0),
    invalidationItemCount: turns.reduce((total, turn) => total + turn.invalidationItemCount, 0),
    restoreAvailableCount: turns.reduce((total, turn) => total + turn.restoreAvailableCount, 0),
    secondTurnStorageGrowthBytes
  };
}
