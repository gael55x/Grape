import { repoPath, type ParsedArgs } from "./args.js";
import { exitCodes } from "./exit-codes.js";
import { renderProblems, repoOutputOptions, write, writeError, writeJson } from "./render.js";
import type { CliNodeRuntimeFailure } from "./runtime-guard.js";

export function renderRuntimeFailure(parsed: ParsedArgs, failure: CliNodeRuntimeFailure): number {
  const outputOptions = repoOutputOptions(repoPath(parsed));
  if (parsed.command === "doctor") {
    if (parsed.flags.has("--json")) {
      writeJson({
        rootPath: repoPath(parsed),
        overallStatus: "fail",
        checks: [
          {
            id: "node_runtime",
            status: "fail",
            message: failure.message
          }
        ],
        recoveryGuidance: failure.recoveryGuidance
      }, outputOptions);
      return exitCodes.stale;
    }

    write([
      "Grape doctor: fail",
      "",
      `FAIL node_runtime: ${failure.message}`,
      ...renderProblems("Recovery", failure.recoveryGuidance)
    ].join("\n"), outputOptions);
    return exitCodes.stale;
  }

  writeError(failure.message, outputOptions);
  writeError(renderProblems("Recovery", failure.recoveryGuidance).join("\n"), outputOptions);
  return exitCodes.stale;
}
