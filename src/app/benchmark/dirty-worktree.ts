import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { benchmarkSessionId, runBenchmarkCompileTurn } from "./compile-turn.js";
import { execGitInBenchmarkRepo, prepareBenchmarkFixtureRepository } from "./fixture-repo.js";
import type { DirtyWorktreeBenchmarkInput, DirtyWorktreeBenchmarkResult } from "./types.js";

const editedSourceRef = "src/calculateDiscount.ts";

export function runDirtyWorktreeBenchmark(input: DirtyWorktreeBenchmarkInput): DirtyWorktreeBenchmarkResult {
  const prepared = prepareBenchmarkFixtureRepository({
    fixtureName: input.fixtureName,
    fixturePath: input.fixturePath,
    gitBinary: input.gitBinary,
    keepWorkspace: input.keepWorkspace
  });

  const task = input.task;
  const sessionId = benchmarkSessionId(input.fixtureName, "dirty");
  const gitBinary = input.gitBinary ?? "git";

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

    const sourceWasTracked = sourceIsTracked(gitBinary, prepared.repoPath, editedSourceRef);
    const sourceStatusBeforeEdit = gitStatusForSource(gitBinary, prepared.repoPath, editedSourceRef);
    const sourcePath = path.join(prepared.repoPath, ...editedSourceRef.split("/"));
    const source = readFileSync(sourcePath, "utf8");
    writeFileSync(
      sourcePath,
      source.replace("return 0;", "return 0; // uncommitted dirty-worktree fixture change\n")
    );
    const sourceStatusAfterEdit = gitStatusForSource(gitBinary, prepared.repoPath, editedSourceRef);

    const second = runBenchmarkCompileTurn({
      repoPath: prepared.repoPath,
      task,
      sessionId,
      turn: 2,
      now: input.now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir
    });

    const scenario = dirtyWorktreeScenario({
      sourceWasTracked,
      sourceStatusBeforeEdit,
      sourceStatusAfterEdit,
      second
    });
    const failures = dirtyWorktreeFailures({ scenario, second });
    return {
      benchmark: "bench_dirty_worktree_invalidation",
      fixture: input.fixtureName,
      task,
      status: failures.length === 0 ? "pass" : "fail",
      workspacePath: input.keepWorkspace ? prepared.workspacePath : undefined,
      scenario,
      turns: [first, second],
      failures
    };
  } finally {
    prepared.cleanup();
  }
}

function dirtyWorktreeScenario(input: {
  readonly sourceWasTracked: boolean;
  readonly sourceStatusBeforeEdit: readonly string[];
  readonly sourceStatusAfterEdit: readonly string[];
  readonly second: {
    readonly dirtyWorktree: boolean;
    readonly stateCounts: Record<string, number>;
    readonly sectionTokenBreakdown: readonly {
      readonly state: string;
      readonly itemRef: string;
      readonly inputRefs: readonly string[];
    }[];
  };
}): DirtyWorktreeBenchmarkResult["scenario"] {
  return {
    editedSourceRef,
    sourceWasTracked: input.sourceWasTracked,
    sourceCleanBeforeEdit: input.sourceStatusBeforeEdit.length === 0,
    sourceDirtyAfterEdit: input.sourceStatusAfterEdit.some((line) => line.endsWith(` ${editedSourceRef}`)),
    dirtyStatusAfterEdit: input.sourceStatusAfterEdit,
    dirtyWorktreeReported: input.second.dirtyWorktree,
    invalidationItemsReferencingEditedSource: input.second.sectionTokenBreakdown.filter(
      (entry) => entry.state === "INVALIDATE_PREVIOUS" && entry.inputRefs.includes(editedSourceRef)
    ).length,
    omittedUnchangedAfterEdit: input.second.stateCounts.OMIT_UNCHANGED ?? 0
  };
}

function dirtyWorktreeFailures(input: {
  readonly scenario: DirtyWorktreeBenchmarkResult["scenario"];
  readonly second: {
    readonly stateCounts: Record<string, number>;
    readonly unsafeOmissions: number;
    readonly staleItemsSent: number;
  };
}): string[] {
  const { scenario, second } = input;
  const failures: string[] = [];
  if (!scenario.sourceWasTracked) {
    failures.push("dirty_worktree_source_not_tracked");
  }
  if (!scenario.sourceCleanBeforeEdit) {
    failures.push("dirty_worktree_source_not_clean_before_edit");
  }
  if (!scenario.sourceDirtyAfterEdit) {
    failures.push("dirty_worktree_source_not_dirty_after_edit");
  }
  if (!scenario.dirtyWorktreeReported) {
    failures.push("dirty_worktree_not_reported_by_compile");
  }
  if ((second.stateCounts.INVALIDATE_PREVIOUS ?? 0) === 0) {
    failures.push("dirty_worktree_missing_invalidate_previous");
  }
  if (scenario.invalidationItemsReferencingEditedSource === 0) {
    failures.push("dirty_worktree_missing_source_specific_invalidation");
  }
  if (scenario.omittedUnchangedAfterEdit !== 0) {
    failures.push("dirty_worktree_must_not_omit_unchanged");
  }
  if (second.unsafeOmissions !== 0) {
    failures.push("unsafe_omissions_present");
  }
  if (second.staleItemsSent !== 0) {
    failures.push("stale_items_sent_present");
  }
  return failures;
}

function sourceIsTracked(gitBinary: string, repoPath: string, sourceRef: string): boolean {
  try {
    execGitInBenchmarkRepo(gitBinary, repoPath, ["ls-files", "--error-unmatch", "--", sourceRef]);
    return true;
  } catch {
    return false;
  }
}

function gitStatusForSource(gitBinary: string, repoPath: string, sourceRef: string): readonly string[] {
  const output = execGitInBenchmarkRepo(gitBinary, repoPath, ["status", "--porcelain=v1", "--", sourceRef]);
  return output.split("\n").map((line) => line.trimEnd()).filter(Boolean);
}
