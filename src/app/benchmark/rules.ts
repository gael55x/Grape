export type BenchmarkFailureRule = readonly [failure: string, passes: boolean];

export function collectBenchmarkFailures(rules: readonly BenchmarkFailureRule[]): string[] {
  return rules.flatMap(([failure, passes]) => (passes ? [] : [failure]));
}
