import { performance } from "node:perf_hooks";

import { compileLocalContext } from "../local-project/compile.js";
import type { CompileLocalContextResult } from "../local-project/types.js";
import type { BenchmarkTurnMetric } from "./types.js";

export function runBenchmarkCompileTurn(input: {
  readonly repoPath: string;
  readonly task: string;
  readonly sessionId: string;
  readonly turn: number;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}): BenchmarkTurnMetric {
  const started = performance.now();
  const result = compileLocalContext({
    rootPath: input.repoPath,
    task: input.task,
    sessionId: input.sessionId,
    now: input.now,
    gitBinary: input.gitBinary,
    migrationsDir: input.migrationsDir
  });
  const durationMs = Math.round((performance.now() - started) * 100) / 100;
  return turnMetric(input.turn, result, durationMs);
}

export function countPackStates(result: CompileLocalContextResult): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of result.contextPackItems) {
    counts[item.state] = (counts[item.state] ?? 0) + 1;
  }
  return counts;
}

function turnMetric(
  turn: number,
  result: CompileLocalContextResult,
  durationMs: number
): BenchmarkTurnMetric {
  const stateCounts = countPackStates(result);
  return {
    turn,
    artifactId: result.artifactId,
    artifactHash: result.artifactHash,
    durationMs,
    toolCallCount: 1,
    contextPackItemCount: result.contextPackItems.length,
    sentItemCount: result.sentItemCount,
    omittedItemCount: result.omittedItemCount,
    invalidationItemCount: stateCounts.INVALIDATE_PREVIOUS ?? 0,
    restoreAvailableCount: stateCounts.RESTORE_AVAILABLE ?? 0,
    stateCounts,
    naiveTokens: result.tokenMetric.naiveTokens,
    grapeTokens: result.tokenMetric.grapeTokens,
    omittedUnchangedTokens: result.tokenMetric.omittedUnchangedTokens,
    compressionSavedTokens: result.tokenMetric.compressionSavedTokens,
    pinnedOverheadTokens: result.tokenMetric.pinnedOverheadTokens,
    invalidationOverheadTokens: result.tokenMetric.invalidationOverheadTokens,
    unsafeOmissions: result.tokenMetric.unsafeOmissions,
    staleItemsSent: result.tokenMetric.staleItemsSent,
    reductionPercent: result.tokenMetric.reductionPercent
  };
}

export function benchmarkSessionId(fixtureName: string, suffix: string): string {
  const normalized = fixtureName.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `bench-${normalized}-${suffix}`;
}
