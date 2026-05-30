import { runBranchSwitchBenchmark } from "./branch-switch.js";
import { runStaleSourceBenchmark } from "./stale-source.js";
import { runTokenReductionBenchmark } from "./token-reduction.js";
import type { BenchmarkFixtureInput, BenchmarkResult } from "./types.js";

export function runFixtureBenchmark(input: BenchmarkFixtureInput): BenchmarkResult {
  switch (input.fixtureName) {
    case "branch-switch-typescript-app":
      return runBranchSwitchBenchmark(input);
    case "stale-source-typescript-app":
      return runStaleSourceBenchmark(input);
    default:
      return runTokenReductionBenchmark({
        ...input,
        task: input.task ?? "Explain calculateDiscount behavior and the tests that cover it."
      });
  }
}
