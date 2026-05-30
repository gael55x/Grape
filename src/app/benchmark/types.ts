export interface BenchmarkFixtureInput {
  readonly fixtureName: string;
  readonly fixturePath: string;
  readonly task?: string;
  readonly keepWorkspace?: boolean;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface TokenReductionBenchmarkInput extends BenchmarkFixtureInput {
  readonly task: string;
}

export interface BranchSwitchBenchmarkInput extends BenchmarkFixtureInput {}

export interface StaleSourceBenchmarkInput extends BenchmarkFixtureInput {}

export type BenchmarkStatus = "pass" | "fail";

export interface BenchmarkTurnMetric {
  readonly turn: number;
  readonly artifactId: string;
  readonly artifactHash: string;
  readonly durationMs: number;
  readonly toolCallCount: 1;
  readonly contextPackItemCount: number;
  readonly sentItemCount: number;
  readonly omittedItemCount: number;
  readonly invalidationItemCount: number;
  readonly restoreAvailableCount: number;
  readonly stateCounts: Record<string, number>;
  readonly naiveTokens: number;
  readonly grapeTokens: number;
  readonly omittedUnchangedTokens: number;
  readonly compressionSavedTokens: number;
  readonly pinnedOverheadTokens: number;
  readonly invalidationOverheadTokens: number;
  readonly unsafeOmissions: number;
  readonly staleItemsSent: number;
  readonly reductionPercent: number;
}

export interface TokenReductionBenchmarkResult {
  readonly benchmark: "bench_token_reduction_after_first_turn";
  readonly fixture: string;
  readonly task: string;
  readonly status: BenchmarkStatus;
  readonly workspacePath?: string;
  readonly thresholds: {
    readonly minSecondTurnReductionPercent: number;
    readonly requireZeroUnsafeOmissions: true;
    readonly requireZeroStaleItemsSent: true;
    readonly requireSecondTurnOmission: true;
    readonly requireRestoreAvailable: true;
  };
  readonly turns: readonly BenchmarkTurnMetric[];
  readonly totals: {
    readonly wallClockMs: number;
    readonly firstTurnTokens: number;
    readonly secondTurnTokens: number;
    readonly secondTurnNaiveTokens: number;
    readonly secondTurnReductionPercent: number;
    readonly omittedUnchangedTokens: number;
    readonly pinnedOverheadTokens: number;
    readonly invalidationOverheadTokens: number;
    readonly invalidationItemCount: number;
    readonly restoreAvailableCount: number;
  };
  readonly failures: readonly string[];
}

export interface BranchSwitchBenchmarkResult {
  readonly benchmark: "bench_branch_switch_invalidation";
  readonly fixture: string;
  readonly task: string;
  readonly status: BenchmarkStatus;
  readonly workspacePath?: string;
  readonly turns: readonly BenchmarkTurnMetric[];
  readonly failures: readonly string[];
}

export interface StaleSourceBenchmarkResult {
  readonly benchmark: "bench_stale_source_invalidation";
  readonly fixture: string;
  readonly task: string;
  readonly status: BenchmarkStatus;
  readonly workspacePath?: string;
  readonly turns: readonly BenchmarkTurnMetric[];
  readonly failures: readonly string[];
}

export type BenchmarkResult =
  | TokenReductionBenchmarkResult
  | BranchSwitchBenchmarkResult
  | StaleSourceBenchmarkResult;
