import { TRUST_WORDING_DISCLAIMERS } from "../../shared/trust-wording.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, repoOutputOptions, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";

export async function runObservedCommand(parsed: ParsedArgs, mode: "command" | "test"): Promise<number> {
  const allowed =
    mode === "test"
      ? new Set(["--json", "--repo", "--session", "--test-framework"])
      : new Set(["--json", "--repo", "--session"]);
  const flag = unsupportedFlag(parsed, allowed);
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }

  const sessionId = parsed.values.get("--session");
  if (!sessionId) {
    writeError(`grape ${parsed.command} requires --session <id>`);
    return exitCodes.usage;
  }
  if (parsed.positionals.length === 0) {
    writeError(`grape ${parsed.command} requires command arguments after --`);
    return exitCodes.usage;
  }

  try {
    const rootPath = repoPath(parsed);
    const outputOptions = repoOutputOptions(rootPath);
    const { runLocalObservedCommand } = await import("../../app/local-project/observation/observed-runner.js");
    const result = runLocalObservedCommand({
      rootPath,
      sessionId,
      commandArgs: parsed.positionals,
      mode,
      testFramework: mode === "test" ? parsed.values.get("--test-framework") : undefined
    });

    if (parsed.flags.has("--json")) {
      writeJson(stripRootPath(result), outputOptions);
      return result.exitCode;
    }

    write([
      mode === "test" ? "Grape-observed test run recorded." : "Grape-observed command run recorded.",
      "",
      `Observed run: ${result.observedRunId}`,
      `Source: ${result.sourceId}`,
      result.claimId ? `Claim: ${result.claimId}` : undefined,
      result.proofId ? `Proof: ${result.proofId}` : undefined,
      `Trust class: ${result.trustClass}`,
      `Exit code: ${result.exitCode}`,
      result.passed === undefined ? undefined : `Passed: ${result.passed ? "yes" : "no"}`,
      `Command hash: ${result.commandHash}`,
      `Stdout: ${result.stdoutBytes} bytes (${result.stdoutHash})`,
      `Stderr: ${result.stderrBytes} bytes (${result.stderrHash})`,
      `Warnings: ${result.warnings.length === 0 ? "none" : result.warnings.join(", ")}`,
      result.claimId ? TRUST_WORDING_DISCLAIMERS.observedRunCliNote : undefined
    ].filter((line): line is string => line !== undefined).join("\n"), outputOptions);
    return result.exitCode;
  } catch (error) {
    writeError(`grape ${parsed.command} failed: ${errorMessage(error)}`, repoOutputOptions(repoPath(parsed)));
    return observedRunErrorExitCode(error);
  }
}

function stripRootPath<T extends { readonly rootPath: string }>(result: T): Omit<T, "rootPath"> {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}

function observedRunErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.includes("requires") || message.includes("must be")) return exitCodes.usage;
  if (message.includes("secret scan blocked")) return exitCodes.unsafe;
  if (message.includes("context session not found") || message.includes("context session is stale")) {
    return exitCodes.stale;
  }
  return exitCodes.storage;
}
