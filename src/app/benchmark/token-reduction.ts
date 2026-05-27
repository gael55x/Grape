import { performance } from "node:perf_hooks";

import { compileLocalContext } from "../local-project/compile.js";
import type { CompileLocalContextResult } from "../local-project/types.js";
import { prepareBenchmarkFixtureRepository } from "./fixture-repo.js";
import type {
  BenchmarkTurnMetric,
  TokenReductionBenchmarkInput,
  TokenReductionBenchmarkResult
} from "./types.js";

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
    const sessionId = `bench-${safeId(input.fixtureName)}`;
    const first = runCompileTurn({
      repoPath: prepared.repoPath,
      task: input.task,
      sessionId,
      turn: 1,
      now: input.now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir
    });
    const second = runCompileTurn({
      repoPath: prepared.repoPath,
      task: input.task,
      sessionId,
      turn: 2,
      now: input.now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir
    });
    const turns = [first, second];
    const failures = benchmarkFailures(second);

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

function runCompileTurn(input: {
  readonly repoPath: string;
  readonly task: string;
  readonly sessionId: string;
  readonly turn: number;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}): BenchmarkTurnMetric {
  const started = performance.now();
  const result = compileLocalContext({
    rootPath: input.repoPath,
    task: input.task,
    sessionId: input.sessionId,
    now: input.now,
    gitBinary: input.gitBinary,
    migrationsDir: input.migrationsDir
  });
  const durationMs = Math.round((performance.now() - started) * 100) / 100;

  return turnMetric(input.turn, result, durationMs);
}

function turnMetric(
  turn: number,
  result: CompileLocalContextResult,
  durationMs: number
): BenchmarkTurnMetric {
  const stateCounts = countStates(result);
  return {
    turn,
    artifactId: result.artifactId,
    artifactHash: result.artifactHash,
    durationMs,
    toolCallCount: 1,
    contextPackItemCount: result.contextPackItems.length,
    sentItemCount: result.sentItemCount,
    omittedItemCount: result.omittedItemCount,
    invalidationItemCount: stateCounts.INVALIDATE_PREVIOUS ?? 0,
    restoreAvailableCount: stateCounts.RESTORE_AVAILABLE ?? 0,
    stateCounts,
    naiveTokens: result.tokenMetric.naiveTokens,
    grapeTokens: result.tokenMetric.grapeTokens,
    omittedUnchangedTokens: result.tokenMetric.omittedUnchangedTokens,
    compressionSavedTokens: result.tokenMetric.compressionSavedTokens,
    pinnedOverheadTokens: result.tokenMetric.pinnedOverheadTokens,
    invalidationOverheadTokens: result.tokenMetric.invalidationOverheadTokens,
    unsafeOmissions: result.tokenMetric.unsafeOmissions,
    staleItemsSent: result.tokenMetric.staleItemsSent,
    reductionPercent: result.tokenMetric.reductionPercent
  };
}

function countStates(result: CompileLocalContextResult): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of result.contextPackItems) {
    counts[item.state] = (counts[item.state] ?? 0) + 1;
  }
  return counts;
}

function benchmarkFailures(secondTurn: BenchmarkTurnMetric): string[] {
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

function totalsFor(turns: readonly BenchmarkTurnMetric[]): TokenReductionBenchmarkResult["totals"] {
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

function safeId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, "-");
  return normalized.length > 0 ? normalized : "fixture";
}
