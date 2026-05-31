import { benchmarkSessionId, runBenchmarkCompileTurn } from "./compile-turn.js";
import { prepareBenchmarkFixtureRepository } from "./fixture-repo.js";
import type { SessionResetBenchmarkInput, SessionResetBenchmarkResult } from "./types.js";

const defaultTask = "Explain session reset handling and the tests that cover it.";

export function runSessionResetBenchmark(input: SessionResetBenchmarkInput): SessionResetBenchmarkResult {
  const prepared = prepareBenchmarkFixtureRepository({
    fixtureName: input.fixtureName,
    fixturePath: input.fixturePath,
    gitBinary: input.gitBinary,
    keepWorkspace: input.keepWorkspace
  });

  const task = input.task ?? defaultTask;
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
      status: failures.length === 0 ? "pass" : "fail",
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
  const failures: string[] = [];
  if ((secondTurn.stateCounts.INVALIDATE_PREVIOUS ?? 0) === 0) {
    failures.push("session_reset_missing_invalidate_previous");
  }
  if ((secondTurn.stateCounts.NEW ?? 0) === 0) {
    failures.push("session_reset_missing_full_resend_new_items");
  }
  if ((secondTurn.stateCounts.OMIT_UNCHANGED ?? 0) !== 0) {
    failures.push("session_reset_must_not_omit_unchanged");
  }
  if (secondTurn.unsafeOmissions !== 0) {
    failures.push("unsafe_omissions_present");
  }
  if (secondTurn.staleItemsSent !== 0) {
    failures.push("stale_items_sent_present");
  }
  return failures;
}
