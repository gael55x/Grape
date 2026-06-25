import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { benchmarkSessionId, runBenchmarkCompileTurn } from "./compile-turn.js";
import { prepareBenchmarkFixtureRepository } from "./fixture-repo.js";
import { collectBenchmarkFailures, roundBenchmarkMetric } from "./rules.js";
import type {
  BenchmarkTurnMetric,
  ChangedFileInvalidationBenchmarkGate,
  StaleSourceBenchmarkInput,
  StaleSourceBenchmarkResult
} from "./types.js";

const changedSourceRef = "src/calculateDiscount.ts";
const maxChangedFileInvalidationSecondTurnDurationMs = 5_000;

export function runStaleSourceBenchmark(input: StaleSourceBenchmarkInput): StaleSourceBenchmarkResult {
  const prepared = prepareBenchmarkFixtureRepository({
    fixtureName: input.fixtureName,
    fixturePath: input.fixturePath,
    gitBinary: input.gitBinary,
    keepWorkspace: input.keepWorkspace
  });

  const task = input.task;
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

    const sourcePath = path.join(prepared.repoPath, ...changedSourceRef.split("/"));
    const source = readFileSync(sourcePath, "utf8");
    const editedSource = source.replace(
      "return 0;",
      "return 0; // dependency-stale compile fixture change\n"
    );
    const changedSourceEditApplied = editedSource !== source;
    writeFileSync(sourcePath, editedSource);

    const second = runBenchmarkCompileTurn({
      repoPath: prepared.repoPath,
      task,
      sessionId,
      turn: 2,
      now: input.now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir
    });

    const changedFileInvalidation = changedFileInvalidationGate({
      first,
      second,
      changedSourceEditApplied
    });
    const failures = [
      ...staleSourceFailures(second),
      ...changedFileInvalidation.failures.map(
        (failure) => `${changedFileInvalidation.benchmark}:${failure}`
      )
    ];
    return {
      benchmark: "bench_stale_source_invalidation",
      fixture: input.fixtureName,
      task,
      status: failures.length === 0 ? "pass" : "fail",
      workspacePath: input.keepWorkspace ? prepared.workspacePath : undefined,
      changedFileInvalidation,
      turns: [first, second],
      failures
    };
  } finally {
    prepared.cleanup();
  }
}

function staleSourceFailures(secondTurn: {
  readonly stateCounts: Record<string, number>;
  readonly unsafeOmissions: number;
  readonly staleItemsSent: number;
}): string[] {
  return collectBenchmarkFailures([
    ["stale_source_missing_invalidate_previous", (secondTurn.stateCounts.INVALIDATE_PREVIOUS ?? 0) > 0],
    ["unsafe_omissions_present", secondTurn.unsafeOmissions === 0],
    ["stale_items_sent_present", secondTurn.staleItemsSent === 0]
  ]);
}

function changedFileInvalidationGate(input: {
  readonly first: BenchmarkTurnMetric;
  readonly second: BenchmarkTurnMetric;
  readonly changedSourceEditApplied: boolean;
}): ChangedFileInvalidationBenchmarkGate {
  const { first: firstTurn, second: secondTurn } = input;
  const invalidationItemsReferencingChangedSource = secondTurn.sectionTokenBreakdown.filter(
    (entry) => entry.state === "INVALIDATE_PREVIOUS" && entry.inputRefs.includes(changedSourceRef)
  ).length;
  const secondTurnOmitUnchangedCount = secondTurn.stateCounts.OMIT_UNCHANGED ?? 0;
  const secondTurnDurationRatio =
    firstTurn.durationMs > 0 ? roundBenchmarkMetric(secondTurn.durationMs / firstTurn.durationMs) : 0;
  const failures = collectBenchmarkFailures([
    ["changed_file_edit_not_applied", input.changedSourceEditApplied],
    [
      "second_turn_duration_above_threshold",
      secondTurn.durationMs <= maxChangedFileInvalidationSecondTurnDurationMs
    ],
    ["changed_file_missing_invalidate_previous", secondTurn.invalidationItemCount > 0],
    [
      "changed_file_missing_source_specific_invalidation",
      invalidationItemsReferencingChangedSource > 0
    ],
    ["changed_file_must_not_omit_unchanged", secondTurnOmitUnchangedCount === 0],
    ["unsafe_omissions_present", secondTurn.unsafeOmissions === 0],
    ["stale_items_sent_present", secondTurn.staleItemsSent === 0]
  ]);

  return {
    benchmark: "bench_changed_file_invalidation_time",
    status: failures.length === 0 ? "pass" : "fail",
    thresholds: {
      maxSecondTurnDurationMs: maxChangedFileInvalidationSecondTurnDurationMs,
      requireSourceEditApplied: true,
      requireInvalidatePrevious: true,
      requireChangedSourceInvalidation: true,
      requireNoOmitUnchangedAfterChange: true,
      requireZeroUnsafeOmissions: true,
      requireZeroStaleItemsSent: true
    },
    changedSourceRef,
    firstTurnDurationMs: firstTurn.durationMs,
    secondTurnDurationMs: secondTurn.durationMs,
    secondTurnDurationRatio,
    secondTurnInvalidationItemCount: secondTurn.invalidationItemCount,
    secondTurnOmitUnchangedCount,
    invalidationItemsReferencingChangedSource,
    changedSourceEditApplied: input.changedSourceEditApplied,
    secondTurnDirtyWorktree: secondTurn.dirtyWorktree,
    failures
  };
}
