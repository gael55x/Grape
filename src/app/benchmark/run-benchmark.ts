import { runBranchSwitchBenchmark } from "./branch-switch.js";
import { runDirtyWorktreeBenchmark } from "./dirty-worktree.js";
import { runSessionResetBenchmark } from "./session-reset.js";
import { runStaleSourceBenchmark } from "./stale-source.js";
import { runTokenReductionBenchmark } from "./token-reduction.js";
import { resolveBenchmarkTask } from "./fixture-metadata.js";
import type { BenchmarkFixtureInput, BenchmarkResult } from "./types.js";

export function runFixtureBenchmark(input: BenchmarkFixtureInput): BenchmarkResult {
  const resolvedInput = {
    ...input,
    task: resolveBenchmarkTask(input)
  };

  switch (input.fixtureName) {
    case "branch-switch-typescript-app":
      return runBranchSwitchBenchmark(resolvedInput);
    case "dirty-worktree-typescript-app":
      return runDirtyWorktreeBenchmark(resolvedInput);
    case "session-reset-typescript-app":
      return runSessionResetBenchmark(resolvedInput);
    case "stale-source-typescript-app":
      return runStaleSourceBenchmark(resolvedInput);
    default:
      return runTokenReductionBenchmark(resolvedInput);
  }
}
