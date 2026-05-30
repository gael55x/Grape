import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { benchmarkSessionId, runBenchmarkCompileTurn } from "./compile-turn.js";
import { execGitInBenchmarkRepo, prepareBenchmarkFixtureRepository } from "./fixture-repo.js";
import type { BranchSwitchBenchmarkInput, BranchSwitchBenchmarkResult } from "./types.js";

const defaultTask = "Explain calculateDiscount behavior and the tests that cover it.";

export function runBranchSwitchBenchmark(input: BranchSwitchBenchmarkInput): BranchSwitchBenchmarkResult {
  const prepared = prepareBenchmarkFixtureRepository({
    fixtureName: input.fixtureName,
    fixturePath: input.fixturePath,
    gitBinary: input.gitBinary,
    keepWorkspace: input.keepWorkspace
  });

  const gitBinary = input.gitBinary ?? "git";
  const task = input.task ?? defaultTask;
  const sessionId = benchmarkSessionId(input.fixtureName, "branch");

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

    execGitInBenchmarkRepo(gitBinary, prepared.repoPath, ["checkout", "-b", "feature/context"]);
    const sourcePath = path.join(prepared.repoPath, "src", "calculateDiscount.ts");
    const source = readFileSync(sourcePath, "utf8");
    writeFileSync(
      sourcePath,
      source.replace("return 0;", "return 0; // branch-specific compile fixture change\n")
    );
    execGitInBenchmarkRepo(gitBinary, prepared.repoPath, ["add", "src/calculateDiscount.ts"]);
    execGitInBenchmarkRepo(gitBinary, prepared.repoPath, [
      "-c",
      "user.name=Grape Benchmark",
      "-c",
      "user.email=benchmark@grape.local",
      "commit",
      "-m",
      "feature branch change"
    ]);

    const second = runBenchmarkCompileTurn({
      repoPath: prepared.repoPath,
      task,
      sessionId,
      turn: 2,
      now: input.now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir
    });

    const failures = branchSwitchFailures(second);
    return {
      benchmark: "bench_branch_switch_invalidation",
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

function branchSwitchFailures(secondTurn: { readonly stateCounts: Record<string, number>; readonly unsafeOmissions: number; readonly staleItemsSent: number }): string[] {
  const failures: string[] = [];
  if ((secondTurn.stateCounts.INVALIDATE_PREVIOUS ?? 0) === 0) {
    failures.push("branch_switch_missing_invalidate_previous");
  }
  if (secondTurn.unsafeOmissions !== 0) {
    failures.push("unsafe_omissions_present");
  }
  if (secondTurn.staleItemsSent !== 0) {
    failures.push("stale_items_sent_present");
  }
  return failures;
}
