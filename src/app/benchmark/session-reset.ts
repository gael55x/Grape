import { benchmarkSessionId, runBenchmarkCompileTurn } from "./compile-turn.js";
import { prepareBenchmarkFixtureRepository } from "./fixture-repo.js";
import { benchmarkRules } from "./rules.js";
import type { SessionResetBenchmarkInput, SessionResetBenchmarkResult } from "./types.js";

export function runSessionResetBenchmark(input: SessionResetBenchmarkInput): SessionResetBenchmarkResult {
  const prepared = prepareBenchmarkFixtureRepository({
    fixtureName: input.fixtureName,
    fixturePath: input.fixturePath,
    gitBinary: input.gitBinary,
    keepWorkspace: input.keepWorkspace
  });

  const task = input.task;
  const sessionId = benchmarkSessionId(input.fixtureName, "reset");

  try {
    const first = runBenchmarkCompileTurn({
      repoPath: prepared.repoPath,
      task,
      sessionId,
      turn: 1,
      now: input.now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir
    });

    const second = runBenchmarkCompileTurn({
      repoPath: prepared.repoPath,
      task,
      sessionId,
      turn: 2,
      now: input.now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir,
      resetSession: true
    });

    const failures = sessionResetFailures(second);
    return {
      benchmark: "bench_diff_vs_naive_resend",
      fixture: input.fixtureName,
      task,
      status: benchmarkRules.status(failures),
      workspacePath: input.keepWorkspace ? prepared.workspacePath : undefined,
      turns: [first, second],
      failures
    };
  } finally {
    prepared.cleanup();
  }
}

function sessionResetFailures(secondTurn: {
  readonly stateCounts: Record<string, number>;
  readonly unsafeOmissions: number;
  readonly staleItemsSent: number;
}): string[] {
  return benchmarkRules.collectFailures([
    ["session_reset_missing_invalidate_previous", (secondTurn.stateCounts.INVALIDATE_PREVIOUS ?? 0) > 0],
    ["session_reset_missing_full_resend_new_items", (secondTurn.stateCounts.NEW ?? 0) > 0],
    ["session_reset_must_not_omit_unchanged", (secondTurn.stateCounts.OMIT_UNCHANGED ?? 0) === 0],
    ["unsafe_omissions_present", secondTurn.unsafeOmissions === 0],
    ["stale_items_sent_present", secondTurn.staleItemsSent === 0]
  ]);
}
