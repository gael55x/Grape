import { benchmarkSessionId, runBenchmarkCompileTurn } from "./compile-turn.js";
import { prepareBenchmarkFixtureRepository } from "./fixture-repo.js";
import type { TokenReductionBenchmarkInput, TokenReductionBenchmarkResult } from "./types.js";

const minSecondTurnReductionPercent = 30;

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
    const failures = tokenReductionFailures(second);

    return {
      benchmark: "bench_token_reduction_after_first_turn",
      fixture: input.fixtureName,
      task: input.task,
      status: failures.length === 0 ? "pass" : "fail",
      workspacePath: input.keepWorkspace ? prepared.workspacePath : undefined,
      thresholds: {
        minSecondTurnReductionPercent,
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

function tokenReductionFailures(secondTurn: {
  readonly reductionPercent: number;
  readonly unsafeOmissions: number;
  readonly staleItemsSent: number;
  readonly stateCounts: Record<string, number>;
  readonly restoreAvailableCount: number;
}): string[] {
  const failures: string[] = [];
  if (secondTurn.reductionPercent < minSecondTurnReductionPercent) {
    failures.push("second_turn_reduction_below_threshold");
  }
  if (secondTurn.unsafeOmissions !== 0) {
    failures.push("unsafe_omissions_present");
  }
  if (secondTurn.staleItemsSent !== 0) {
    failures.push("stale_items_sent_present");
  }
  if ((secondTurn.stateCounts.OMIT_UNCHANGED ?? 0) === 0) {
    failures.push("second_turn_missing_omit_unchanged");
  }
  if (secondTurn.restoreAvailableCount === 0) {
    failures.push("second_turn_missing_restore_available");
  }
  return failures;
}

function totalsFor(turns: readonly { readonly durationMs: number; readonly grapeTokens: number; readonly naiveTokens: number; readonly reductionPercent: number; readonly omittedUnchangedTokens: number; readonly pinnedOverheadTokens: number; readonly invalidationOverheadTokens: number; readonly invalidationItemCount: number; readonly restoreAvailableCount: number }[]): TokenReductionBenchmarkResult["totals"] {
  const [first, second] = turns;
  return {
    wallClockMs: Math.round(turns.reduce((total, turn) => total + turn.durationMs, 0) * 100) / 100,
    firstTurnTokens: first?.grapeTokens ?? 0,
    secondTurnTokens: second?.grapeTokens ?? 0,
    secondTurnNaiveTokens: second?.naiveTokens ?? 0,
    secondTurnReductionPercent: second?.reductionPercent ?? 0,
    omittedUnchangedTokens: turns.reduce((total, turn) => total + turn.omittedUnchangedTokens, 0),
    pinnedOverheadTokens: turns.reduce((total, turn) => total + turn.pinnedOverheadTokens, 0),
    invalidationOverheadTokens: turns.reduce((total, turn) => total + turn.invalidationOverheadTokens, 0),
    invalidationItemCount: turns.reduce((total, turn) => total + turn.invalidationItemCount, 0),
    restoreAvailableCount: turns.reduce((total, turn) => total + turn.restoreAvailableCount, 0)
  };
}
