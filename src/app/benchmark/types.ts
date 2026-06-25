import type { StorageFootprint } from "../local-project/maintenance/storage-footprint.js";

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

export interface BranchSwitchBenchmarkInput extends BenchmarkFixtureInput {
  readonly task: string;
}

export interface StaleSourceBenchmarkInput extends BenchmarkFixtureInput {
  readonly task: string;
}

export interface DirtyWorktreeBenchmarkInput extends BenchmarkFixtureInput {
  readonly task: string;
}

export interface SessionResetBenchmarkInput extends BenchmarkFixtureInput {
  readonly task: string;
}

export type BenchmarkStatus = "pass" | "fail";

export interface BenchmarkStateTokenBreakdown {
  readonly state: string;
  readonly itemCount: number;
  readonly bodyTokens: number;
  readonly serializedTokens: number;
}

export interface BenchmarkSectionTokenBreakdown {
  readonly sectionId: string;
  readonly state: string;
  readonly itemKind: string;
  readonly itemRef: string;
  readonly inputRefs: readonly string[];
  readonly bodyTokens: number;
  readonly serializedTokens: number;
}

export interface BenchmarkTurnMetric {
  readonly turn: number;
  readonly artifactId: string;
  readonly artifactHash: string;
  readonly dirtyWorktree: boolean;
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
  readonly serializedPackTokens: number;
  readonly serializedAgentOutputTokens: number;
  readonly serializedAgentStructuredTokens: number;
  readonly serializedAgentTextTokens: number;
  readonly omittedUnchangedTokens: number;
  readonly compressionSavedTokens: number;
  readonly pinnedOverheadTokens: number;
  readonly invalidationOverheadTokens: number;
  readonly unsafeOmissions: number;
  readonly staleItemsSent: number;
  readonly reductionPercent: number;
  readonly overheadPercent: number;
  readonly agentOutputOverheadPercent: number;
  readonly storageFootprint: StorageFootprint;
  readonly stateTokenBreakdown: readonly BenchmarkStateTokenBreakdown[];
  readonly sectionTokenBreakdown: readonly BenchmarkSectionTokenBreakdown[];
}

export interface NoChangeSyncBenchmarkGate {
  readonly benchmark: "bench_no_change_sync_time";
  readonly status: BenchmarkStatus;
  readonly thresholds: {
    readonly maxSecondTurnDurationRatio: number;
    readonly requireCleanSecondTurn: true;
    readonly requireSecondTurnOmission: true;
    readonly requireZeroUnsafeOmissions: true;
    readonly requireZeroStaleItemsSent: true;
  };
  readonly firstTurnDurationMs: number;
  readonly secondTurnDurationMs: number;
  readonly secondTurnDurationRatio: number;
  readonly secondTurnOmittedItemCount: number;
  readonly secondTurnRestoreAvailableCount: number;
  readonly secondTurnDirtyWorktree: boolean;
  readonly failures: readonly string[];
}

export interface TokenReductionBenchmarkResult {
  readonly benchmark: "bench_token_reduction_after_first_turn";
  readonly fixture: string;
  readonly task: string;
  readonly status: BenchmarkStatus;
  readonly workspacePath?: string;
  readonly thresholds: {
    readonly minSecondTurnReductionPercent: number;
    readonly maxFirstTurnOverheadPercent: number;
    readonly maxFirstTurnAgentOutputOverheadPercent: number;
    readonly maxSecondTurnStorageGrowthBytes: number;
    readonly requireZeroUnsafeOmissions: true;
    readonly requireZeroStaleItemsSent: true;
    readonly requireSecondTurnOmission: true;
    readonly requireRestoreAvailable: true;
  };
  readonly noChangeSync: NoChangeSyncBenchmarkGate;
  readonly turns: readonly BenchmarkTurnMetric[];
  readonly totals: {
    readonly wallClockMs: number;
    readonly firstTurnTokens: number;
    readonly firstTurnNaiveTokens: number;
    readonly firstTurnOverheadPercent: number;
    readonly secondTurnTokens: number;
    readonly secondTurnNaiveTokens: number;
    readonly secondTurnReductionPercent: number;
    readonly serializedPackTokens: number;
    readonly serializedAgentOutputTokens: number;
    readonly firstTurnAgentOutputOverheadPercent: number;
    readonly omittedUnchangedTokens: number;
    readonly pinnedOverheadTokens: number;
    readonly invalidationOverheadTokens: number;
    readonly invalidationItemCount: number;
    readonly restoreAvailableCount: number;
    readonly secondTurnStorageGrowthBytes: number;
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

export interface DirtyWorktreeBenchmarkResult {
  readonly benchmark: "bench_dirty_worktree_invalidation";
  readonly fixture: string;
  readonly task: string;
  readonly status: BenchmarkStatus;
  readonly workspacePath?: string;
  readonly scenario: {
    readonly editedSourceRef: string;
    readonly sourceWasTracked: boolean;
    readonly sourceCleanBeforeEdit: boolean;
    readonly sourceDirtyAfterEdit: boolean;
    readonly dirtyStatusAfterEdit: readonly string[];
    readonly dirtyWorktreeReported: boolean;
    readonly invalidationItemsReferencingEditedSource: number;
    readonly omittedUnchangedAfterEdit: number;
  };
  readonly turns: readonly BenchmarkTurnMetric[];
  readonly failures: readonly string[];
}

export interface SessionResetBenchmarkResult {
  readonly benchmark: "bench_diff_vs_naive_resend";
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
  | StaleSourceBenchmarkResult
  | DirtyWorktreeBenchmarkResult
  | SessionResetBenchmarkResult;
