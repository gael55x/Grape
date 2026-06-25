import { benchmarkSessionId, runBenchmarkCompileTurn } from "./compile-turn.js";
import { prepareBenchmarkFixtureRepository } from "./fixture-repo.js";
import { benchmarkRules } from "./rules.js";
import type {
  BenchmarkTurnMetric,
  NoChangeSyncBenchmarkGate,
  TokenReductionBenchmarkInput,
  TokenReductionBenchmarkResult
} from "./types.js";

const minSecondTurnReductionPercent = 30;
const maxFirstTurnOverheadPercent = 10;
const maxFirstTurnAgentOutputOverheadPercent = 400;
const maxSecondTurnStorageGrowthBytes = 5 * 1024 * 1024;
const maxNoChangeSyncSecondTurnDurationRatio = 2;

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
    const noChangeSync = noChangeSyncGate(first, second);
    const failures = [
      ...tokenReductionFailures(first, second),
      ...benchmarkRules.prefixFailures(noChangeSync.benchmark, noChangeSync.failures)
    ];

    return {
      benchmark: "bench_token_reduction_after_first_turn",
      fixture: input.fixtureName,
      task: input.task,
      status: benchmarkRules.status(failures),
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
      noChangeSync,
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
  return benchmarkRules.collectFailures([
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

function noChangeSyncGate(
  firstTurn: BenchmarkTurnMetric,
  secondTurn: BenchmarkTurnMetric
): NoChangeSyncBenchmarkGate {
  const secondTurnDurationRatio = benchmarkRules.durationRatio(firstTurn.durationMs, secondTurn.durationMs);
  const failures = benchmarkRules.collectFailures([
    [
      "second_turn_duration_ratio_above_threshold",
      secondTurnDurationRatio <= maxNoChangeSyncSecondTurnDurationRatio
    ],
    ["second_turn_dirty_worktree", !secondTurn.dirtyWorktree],
    ["second_turn_missing_omit_unchanged", (secondTurn.stateCounts.OMIT_UNCHANGED ?? 0) > 0],
    ["unsafe_omissions_present", secondTurn.unsafeOmissions === 0],
    ["stale_items_sent_present", secondTurn.staleItemsSent === 0]
  ]);

  return {
    benchmark: "bench_no_change_sync_time",
    status: benchmarkRules.status(failures),
    thresholds: {
      maxSecondTurnDurationRatio: maxNoChangeSyncSecondTurnDurationRatio,
      requireCleanSecondTurn: true,
      requireSecondTurnOmission: true,
      requireZeroUnsafeOmissions: true,
      requireZeroStaleItemsSent: true
    },
    firstTurnDurationMs: firstTurn.durationMs,
    secondTurnDurationMs: secondTurn.durationMs,
    secondTurnDurationRatio,
    secondTurnOmittedItemCount: secondTurn.omittedItemCount,
    secondTurnRestoreAvailableCount: secondTurn.restoreAvailableCount,
    secondTurnDirtyWorktree: secondTurn.dirtyWorktree,
    failures
  };
}

function totalsFor(turns: readonly BenchmarkTurnMetric[]): TokenReductionBenchmarkResult["totals"] {
  const [first, second] = turns;
  const total = (select: (turn: BenchmarkTurnMetric) => number): number =>
    benchmarkRules.sum(turns, select);
  const secondTurnStorageGrowthBytes =
    second && first ? second.storageFootprint.grapeBytes - first.storageFootprint.grapeBytes : 0;
  return {
    wallClockMs: benchmarkRules.round(total((turn) => turn.durationMs)),
    firstTurnTokens: first?.grapeTokens ?? 0,
    firstTurnNaiveTokens: first?.naiveTokens ?? 0,
    firstTurnOverheadPercent: first?.overheadPercent ?? 0,
    secondTurnTokens: second?.grapeTokens ?? 0,
    secondTurnNaiveTokens: second?.naiveTokens ?? 0,
    secondTurnReductionPercent: second?.reductionPercent ?? 0,
    serializedPackTokens: total((turn) => turn.serializedPackTokens),
    serializedAgentOutputTokens: total((turn) => turn.serializedAgentOutputTokens),
    firstTurnAgentOutputOverheadPercent: first?.agentOutputOverheadPercent ?? 0,
    omittedUnchangedTokens: total((turn) => turn.omittedUnchangedTokens),
    pinnedOverheadTokens: total((turn) => turn.pinnedOverheadTokens),
    invalidationOverheadTokens: total((turn) => turn.invalidationOverheadTokens),
    invalidationItemCount: total((turn) => turn.invalidationItemCount),
    restoreAvailableCount: total((turn) => turn.restoreAvailableCount),
    secondTurnStorageGrowthBytes
  };
}
