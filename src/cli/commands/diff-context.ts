import type { ParsedArgs } from "../args.js";
import { runCompileLike } from "./compile.js";

export async function runDiffContext(parsed: ParsedArgs): Promise<number> {
  return runCompileLike(parsed, {
    commandLabel: "diff-context",
    missingTaskMessage: "grape diff-context requires --task <text>",
    successTitle: "Grape context diff generated."
  });
}
