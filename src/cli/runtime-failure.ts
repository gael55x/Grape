import { repoPath, type ParsedArgs } from "./args.js";
import { exitCodes } from "./exit-codes.js";
import { renderProblems, write, writeError, writeJson } from "./render.js";
import type { CliNodeRuntimeFailure } from "./runtime-guard.js";

export function renderRuntimeFailure(parsed: ParsedArgs, failure: CliNodeRuntimeFailure): number {
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
      });
      return exitCodes.stale;
    }

    write([
      "Grape doctor: fail",
      "",
      `FAIL node_runtime: ${failure.message}`,
      ...renderProblems("Recovery", failure.recoveryGuidance)
    ].join("\n"));
    return exitCodes.stale;
  }

  writeError(failure.message);
  writeError(renderProblems("Recovery", failure.recoveryGuidance).join("\n"));
  return exitCodes.stale;
}
