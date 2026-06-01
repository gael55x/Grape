import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";
import type { ListLocalClaimsResult } from "../../app/local-project/index.js";

export async function runClaims(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--active", "--json", "--repo"]));
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }

  try {
    const { listLocalClaims } = await import("../../app/local-project/inspection/claims.js");
    const result = listLocalClaims({
      rootPath: repoPath(parsed),
      activeOnly: true
    });

    if (parsed.flags.has("--json")) {
      writeJson(result);
      return exitCodes.ok;
    }

    write(renderClaims(result));
    return exitCodes.ok;
  } catch (error) {
    writeError(`grape claims failed: ${errorMessage(error)}`);
    return claimsErrorExitCode(error);
  }
}

function renderClaims(result: ListLocalClaimsResult): string {
  return [
    `Active claims: ${result.claims.length}`,
    `Rejected by current-valid filter: ${result.rejectedCount}`,
    result.warnings.length > 0 ? `Warnings: ${result.warnings.join(", ")}` : "Warnings: none",
    "",
    ...result.claims.map((claim) =>
      [
        `${claim.claimId}  ${claim.claimType}  ${claim.verificationStatus}`,
        `  Subject: ${claim.subject}`,
        `  Claim: ${claim.claimText}`,
        `  Proofs: ${claim.proofRefs.length > 0 ? claim.proofRefs.join(", ") : "none"}`
      ].join("\n")
    )
  ].join("\n");
}

function claimsErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.includes("config root path does not match")) return exitCodes.stale;
  return exitCodes.storage;
}
