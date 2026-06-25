export type BenchmarkFailureRule = readonly [failure: string, passes: boolean];

export function collectBenchmarkFailures(rules: readonly BenchmarkFailureRule[]): string[] {
  return rules.flatMap(([failure, passes]) => (passes ? [] : [failure]));
}

export function roundBenchmarkMetric(value: number): number {
  return Math.round(value * 100) / 100;
}
