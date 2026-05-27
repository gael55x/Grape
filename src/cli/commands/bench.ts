import path from "node:path";

import { exitCodes } from "../exit-codes.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, renderProblems, write, writeError, writeJson } from "../render.js";

const defaultBenchmarkTask = "Explain calculateDiscount behavior and the tests that cover it.";

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
    const { runTokenReductionBenchmark } = await import("../../app/benchmark/index.js");
    const result = runTokenReductionBenchmark({
      fixtureName,
      fixturePath: fixturePathFor(parsed, fixtureName),
      task: parsed.values.get("--task") ?? defaultBenchmarkTask,
      keepWorkspace: parsed.flags.has("--keep-workspace")
    });

    if (parsed.flags.has("--json")) {
      writeJson(result);
      return result.status === "pass" ? exitCodes.ok : exitCodes.unsafe;
    }

    write([
      `Grape benchmark: ${result.benchmark}`,
      "",
      `Fixture: ${result.fixture}`,
      `Status: ${result.status}`,
      result.workspacePath ? `Workspace: ${result.workspacePath}` : undefined,
      "",
      ...result.turns.map(renderTurn),
      "",
      `Second-turn reduction: ${result.totals.secondTurnReductionPercent}%`,
      `Omitted unchanged tokens: ${result.totals.omittedUnchangedTokens}`,
      `Restore hints: ${result.totals.restoreAvailableCount}`,
      `Invalidation items: ${result.totals.invalidationItemCount}`,
      ...renderProblems("Failures", result.failures)
    ].filter((line): line is string => line !== undefined).join("\n"));

    return result.status === "pass" ? exitCodes.ok : exitCodes.unsafe;
  } catch (error) {
    writeError(`grape bench failed: ${errorMessage(error)}`);
    return exitCodes.storage;
  }
}

function fixturePathFor(parsed: ParsedArgs, fixtureName: string): string {
  const explicit = parsed.values.get("--fixture-path");
  if (explicit) return path.resolve(explicit);
  return path.resolve(repoPath(parsed), "tests", "fixtures", fixtureName);
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
    `  tokens: ${turn.grapeTokens} grape / ${turn.naiveTokens} naive (${turn.reductionPercent}% reduction)`,
    `  pack items: ${turn.contextPackItemCount}`,
    `  duration: ${turn.durationMs}ms`
  ].join("\n");
}
