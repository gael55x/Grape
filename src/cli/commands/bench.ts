import path from "node:path";

import { TRUST_WORDING_DISCLAIMERS } from "../../shared/trust-wording.js";
import { exitCodes } from "../exit-codes.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, renderProblems, repoOutputOptions, write, writeError, writeJson } from "../render.js";

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
    writeError(`grape bench failed: ${errorMessage(error)}`, repoOutputOptions(repoPath(parsed)));
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
  readonly turns: readonly {
    readonly turn: number;
    readonly grapeTokens: number;
    readonly naiveTokens: number;
    readonly reductionPercent: number;
    readonly contextPackItemCount: number;
    readonly durationMs: number;
    readonly stateCounts: Record<string, number>;
  }[];
  readonly failures: readonly string[];
  readonly totals?: {
    readonly secondTurnReductionPercent: number;
    readonly omittedUnchangedTokens: number;
    readonly restoreAvailableCount: number;
    readonly invalidationItemCount: number;
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
      `Invalidation items: ${result.totals.invalidationItemCount}`
    );
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
}): string {
  return [
    `Turn ${turn.turn}:`,
    `  tokens: ${turn.grapeTokens} grape / ${turn.naiveTokens} naive (${turn.reductionPercent}% fixture estimate vs naive resend)`,
    `  pack items: ${turn.contextPackItemCount}`,
    `  duration: ${turn.durationMs}ms`
  ].join("\n");
}
