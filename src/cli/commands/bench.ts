import path from "node:path";

import { TRUST_WORDING_DISCLAIMERS } from "../../shared/trust-wording.js";
import { exitCodes } from "../exit-codes.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, formatCommandFailure, renderProblems, repoOutputOptions, write, writeError, writeJson } from "../render.js";

export async function runBench(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(
    parsed,
    new Set(["--json", "--repo", "--fixture", "--fixture-path", "--task", "--keep-workspace"])
  );
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }

  const fixtureName = parsed.values.get("--fixture");
  if (!fixtureName) {
    writeError("grape bench requires --fixture <name>");
    return exitCodes.usage;
  }

  try {
    const rootPath = repoPath(parsed);
    const outputOptions = repoOutputOptions(rootPath);
    const { runFixtureBenchmark } = await import("../../app/benchmark/index.js");
    const result = runFixtureBenchmark({
      fixtureName,
      fixturePath: fixturePathFor(parsed, fixtureName, rootPath),
      task: parsed.values.get("--task"),
      keepWorkspace: parsed.flags.has("--keep-workspace")
    });

    if (parsed.flags.has("--json")) {
      writeJson(result, outputOptions);
      return result.status === "pass" ? exitCodes.ok : exitCodes.unsafe;
    }

    write(renderBenchmarkReport(result), outputOptions);

    return result.status === "pass" ? exitCodes.ok : exitCodes.unsafe;
  } catch (error) {
    const { recoveryGuidanceForErrorMessage } = await import("../../app/local-project/setup/recovery.js");
    writeError(
      formatCommandFailure("bench", error, recoveryGuidanceForErrorMessage(errorMessage(error))),
      repoOutputOptions(repoPath(parsed))
    );
    return exitCodes.storage;
  }
}

function fixturePathFor(parsed: ParsedArgs, fixtureName: string, rootPath: string): string {
  const explicit = parsed.values.get("--fixture-path");
  if (explicit) return path.resolve(explicit);
  return path.resolve(rootPath, "tests", "fixtures", fixtureName);
}

function renderBenchmarkReport(result: {
  readonly benchmark: string;
  readonly fixture: string;
  readonly status: string;
  readonly workspacePath?: string;
  readonly scenario?: {
    readonly editedSourceRef: string;
    readonly sourceWasTracked: boolean;
    readonly sourceDirtyAfterEdit: boolean;
    readonly dirtyWorktreeReported: boolean;
    readonly invalidationItemsReferencingEditedSource: number;
    readonly omittedUnchangedAfterEdit: number;
  };
  readonly turns: readonly {
    readonly turn: number;
    readonly grapeTokens: number;
    readonly naiveTokens: number;
    readonly reductionPercent: number;
    readonly contextPackItemCount: number;
    readonly durationMs: number;
    readonly stateCounts: Record<string, number>;
    readonly storageFootprint: {
      readonly grapeBytes: number;
      readonly databaseBytes: number;
      readonly databaseWalBytes: number;
      readonly databaseShmBytes: number;
      readonly artifactBytes: number;
      readonly artifactJsonBytes: number;
      readonly artifactMarkdownBytes: number;
      readonly artifactRepositoryBytes: number;
    };
  }[];
  readonly failures: readonly string[];
  readonly noChangeSync?: {
    readonly status: string;
    readonly secondTurnDurationRatio: number;
    readonly thresholds: {
      readonly maxSecondTurnDurationRatio: number;
    };
  };
  readonly changedFileInvalidation?: {
    readonly status: string;
    readonly changedSourceRef: string;
    readonly secondTurnDurationMs: number;
    readonly thresholds: {
      readonly maxSecondTurnDurationMs: number;
    };
    readonly invalidationItemsReferencingChangedSource: number;
  };
  readonly totals?: {
    readonly secondTurnReductionPercent: number;
    readonly omittedUnchangedTokens: number;
    readonly restoreAvailableCount: number;
    readonly invalidationItemCount: number;
    readonly secondTurnStorageGrowthBytes?: number;
  };
}): string {
  const lines = [
    `Grape benchmark: ${result.benchmark}`,
    TRUST_WORDING_DISCLAIMERS.benchmarkFixtureNote,
    "",
    `Fixture: ${result.fixture}`,
    `Status: ${result.status}`,
    result.workspacePath ? `Workspace: ${result.workspacePath}` : undefined,
    "",
    ...result.turns.map(renderTurn)
  ];

  if (result.totals) {
    lines.push(
      "",
      `Second-turn reduction (fixture estimate vs naive resend): ${result.totals.secondTurnReductionPercent}%`,
      `Omitted unchanged tokens: ${result.totals.omittedUnchangedTokens}`,
      `Restore hints: ${result.totals.restoreAvailableCount}`,
      `Invalidation items: ${result.totals.invalidationItemCount}`,
      `Second-turn .grape byte growth: ${result.totals.secondTurnStorageGrowthBytes ?? "n/a"}`
    );

    if (result.noChangeSync) {
      lines.push(
        `No-change sync gate: ${result.noChangeSync.status} (turn2/turn1 duration ${result.noChangeSync.secondTurnDurationRatio}x, max ${result.noChangeSync.thresholds.maxSecondTurnDurationRatio}x)`
      );
    }
  } else {
    const second = result.turns[1];
    if (second) {
      lines.push(
        "",
        `Second-turn INVALIDATE_PREVIOUS: ${second.stateCounts.INVALIDATE_PREVIOUS ?? 0}`,
        `Second-turn OMIT_UNCHANGED: ${second.stateCounts.OMIT_UNCHANGED ?? 0}`
      );
    }
  }

  if (result.scenario) {
    lines.push(
      "",
      `Dirty source: ${result.scenario.editedSourceRef}`,
      `Source tracked: ${result.scenario.sourceWasTracked}`,
      `Source dirty after edit: ${result.scenario.sourceDirtyAfterEdit}`,
      `Compile reported dirty worktree: ${result.scenario.dirtyWorktreeReported}`,
      `Source-specific invalidations: ${result.scenario.invalidationItemsReferencingEditedSource}`,
      `Omitted unchanged after edit: ${result.scenario.omittedUnchangedAfterEdit}`
    );
  }

  if (result.changedFileInvalidation) {
    lines.push(
      "",
      `Changed-file invalidation gate: ${result.changedFileInvalidation.status} (${result.changedFileInvalidation.changedSourceRef}, turn2 duration ${result.changedFileInvalidation.secondTurnDurationMs}ms, max ${result.changedFileInvalidation.thresholds.maxSecondTurnDurationMs}ms)`,
      `Changed-source invalidations: ${result.changedFileInvalidation.invalidationItemsReferencingChangedSource}`
    );
  }

  return [...lines, ...renderProblems("Failures", result.failures)]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

function renderTurn(turn: {
  readonly turn: number;
  readonly grapeTokens: number;
  readonly naiveTokens: number;
  readonly reductionPercent: number;
  readonly contextPackItemCount: number;
  readonly durationMs: number;
  readonly storageFootprint: {
    readonly grapeBytes: number;
    readonly databaseBytes: number;
    readonly databaseWalBytes: number;
    readonly databaseShmBytes: number;
    readonly artifactBytes: number;
  };
}): string {
  return [
    `Turn ${turn.turn}:`,
    `  tokens: ${turn.grapeTokens} grape / ${turn.naiveTokens} naive (${turn.reductionPercent}% fixture estimate vs naive resend)`,
    `  pack items: ${turn.contextPackItemCount}`,
    `  storage bytes: .grape=${turn.storageFootprint.grapeBytes} db=${turn.storageFootprint.databaseBytes} wal=${turn.storageFootprint.databaseWalBytes} shm=${turn.storageFootprint.databaseShmBytes} artifacts=${turn.storageFootprint.artifactBytes}`,
    `  duration: ${turn.durationMs}ms`
  ].join("\n");
}
