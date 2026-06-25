import type { BenchmarkStatus } from "./types.js";

export type BenchmarkFailureRule = readonly [failure: string, passes: boolean];

export const benchmarkRules = {
  collectFailures: (rules: readonly BenchmarkFailureRule[]): string[] =>
    rules.flatMap(([failure, passes]) => (passes ? [] : [failure])),
  durationRatio: (firstDurationMs: number, secondDurationMs: number): number =>
    firstDurationMs > 0 ? Math.round((secondDurationMs / firstDurationMs) * 100) / 100 : 0,
  prefixFailures: (benchmark: string, failures: readonly string[]): string[] =>
    failures.map((failure) => `${benchmark}:${failure}`),
  round: (value: number): number => Math.round(value * 100) / 100,
  status: (failures: readonly string[]): BenchmarkStatus => (failures.length === 0 ? "pass" : "fail"),
  sum: <T>(items: readonly T[], select: (item: T) => number): number =>
    items.reduce((total, item) => total + select(item), 0)
} as const;
