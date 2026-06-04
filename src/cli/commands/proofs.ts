import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, repoOutputOptions, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";
import type { ListLocalProofsResult } from "../../app/local-project/index.js";

export async function runProofs(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--json", "--repo", "--proof", "--source"]));
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }

  try {
    const rootPath = repoPath(parsed);
    const outputOptions = repoOutputOptions(rootPath);
    const { listLocalProofs } = await import("../../app/local-project/inspection/proofs.js");
    const result = listLocalProofs({
      rootPath,
      proofId: parsed.values.get("--proof"),
      sourceId: parsed.values.get("--source")
    });

    if (parsed.flags.has("--json")) {
      writeJson(result, outputOptions);
      return exitCodes.ok;
    }

    write(renderProofs(result), outputOptions);
    return exitCodes.ok;
  } catch (error) {
    writeError(`grape proofs failed: ${errorMessage(error)}`, repoOutputOptions(repoPath(parsed)));
    return proofsErrorExitCode(error);
  }
}

function renderProofs(result: ListLocalProofsResult): string {
  const filter = [
    result.filter.proofId ? `proof=${result.filter.proofId}` : undefined,
    result.filter.sourceId ? `source=${result.filter.sourceId}` : undefined
  ].filter((value): value is string => Boolean(value));

  return [
    `Proofs: ${result.proofs.length}${filter.length > 0 ? ` (${filter.join(", ")})` : ""}`,
    "",
    ...result.proofs.map((proof) =>
      [
        `${proof.proofId}  ${proof.proofType}  ${proof.supportStatus}`,
        `  Source: ${proof.sourceRef ?? proof.sourceId}`,
        `  Source hash: ${proof.sourceHash}`,
        `  Excerpt hash: ${proof.excerptHash}`,
        `  Claim: ${proof.claimId ?? "none"}`
      ].join("\n")
    )
  ].join("\n");
}

function proofsErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.includes("was not found")) return exitCodes.usage;
  if (message.includes("config root path does not match")) return exitCodes.stale;
  return exitCodes.storage;
}
