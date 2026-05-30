import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { benchmarkSessionId, runBenchmarkCompileTurn } from "./compile-turn.js";
import { prepareBenchmarkFixtureRepository } from "./fixture-repo.js";
import type { StaleSourceBenchmarkInput, StaleSourceBenchmarkResult } from "./types.js";

const defaultTask = "Explain calculateDiscount behavior and the tests that cover it.";

export function runStaleSourceBenchmark(input: StaleSourceBenchmarkInput): StaleSourceBenchmarkResult {
  const prepared = prepareBenchmarkFixtureRepository({
    fixtureName: input.fixtureName,
    fixturePath: input.fixturePath,
    gitBinary: input.gitBinary,
    keepWorkspace: input.keepWorkspace
  });

  const task = input.task ?? defaultTask;
  const sessionId = benchmarkSessionId(input.fixtureName, "stale");

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

    const sourcePath = path.join(prepared.repoPath, "src", "calculateDiscount.ts");
    const source = readFileSync(sourcePath, "utf8");
    writeFileSync(
      sourcePath,
      source.replace("return 0;", "return 0; // dependency-stale compile fixture change\n")
    );

    const second = runBenchmarkCompileTurn({
      repoPath: prepared.repoPath,
      task,
      sessionId,
      turn: 2,
      now: input.now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir
    });

    const failures = staleSourceFailures(second);
    return {
      benchmark: "bench_stale_source_invalidation",
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

function staleSourceFailures(secondTurn: { readonly stateCounts: Record<string, number>; readonly unsafeOmissions: number; readonly staleItemsSent: number }): string[] {
  const failures: string[] = [];
  if ((secondTurn.stateCounts.INVALIDATE_PREVIOUS ?? 0) === 0) {
    failures.push("stale_source_missing_invalidate_previous");
  }
  if (secondTurn.unsafeOmissions !== 0) {
    failures.push("unsafe_omissions_present");
  }
  if (secondTurn.staleItemsSent !== 0) {
    failures.push("stale_items_sent_present");
  }
  return failures;
}
