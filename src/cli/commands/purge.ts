import type { PurgeLocalProjectResult } from "../../app/local-project/index.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { exitCodes } from "../exit-codes.js";
import { errorMessage, formatCommandFailure, repoOutputOptions, write, writeError, writeJson } from "../render.js";

export async function runPurge(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--json", "--repo", "--dry-run", "--confirm"]));
  if (flag) {
    writeError(`Unsupported option for grape purge: ${flag}`);
    return exitCodes.usage;
  }

  if (parsed.flags.has("--dry-run") && parsed.flags.has("--confirm")) {
    writeError("Choose either --dry-run or --confirm, not both.");
    return exitCodes.usage;
  }

  try {
    const rootPath = repoPath(parsed);
    const { purgeLocalProject } = await import("../../app/local-project/privacy/index.js");
    const result = purgeLocalProject({
      rootPath,
      dryRun: parsed.flags.has("--dry-run"),
      confirm: parsed.flags.has("--confirm")
    });
    const outputOptions = repoOutputOptions(rootPath, [result.rootPath]);

    if (parsed.flags.has("--json")) {
      writeJson(result, outputOptions);
      return exitCodes.ok;
    }

    write(renderPurgeResult(result), outputOptions);
    return exitCodes.ok;
  } catch (error) {
    const { recoveryGuidanceForErrorMessage } = await import("../../app/local-project/setup/recovery.js");
    writeError(
      formatCommandFailure("purge", error, recoveryGuidanceForErrorMessage(errorMessage(error))),
      repoOutputOptions(repoPath(parsed))
    );
    return exitCodes.storage;
  }
}

function renderPurgeResult(result: PurgeLocalProjectResult): string {
  return [
    result.applied ? "Grape purge applied." : "Grape purge preview.",
    "",
    `Target: ${result.grapeDirPath}`,
    `Inspected at: ${result.inspectedAt}`,
    `Target exists: ${result.targetExists ? "yes" : "no"}`,
    `Config root: ${configRootLabel(result.configRootStatus)}`,
    `Git-tracked paths under .grape: ${result.trackedPathCount}`,
    `Session lock check: ${sessionLockLabel(result.sessionLocks)}`,
    "",
    "Planned local state:",
    `  Files: ${result.planned.files}`,
    `  Directories: ${result.planned.directories}`,
    `  Symlinks: ${result.planned.symlinks}`,
    `  Bytes: ${result.planned.bytes}`,
    `  Unsupported entries: ${result.planned.specialEntries}`,
    "",
    "Deleted local state:",
    `  Files: ${result.deleted.files}`,
    `  Directories: ${result.deleted.directories}`,
    `  Symlinks: ${result.deleted.symlinks}`,
    `  Bytes: ${result.deleted.bytes}`,
    `  Unsupported entries: ${result.deleted.specialEntries}`,
    "",
    "Notes:",
    ...result.notes.map((note) => `  - ${note}`)
  ].join("\n");
}

function configRootLabel(status: PurgeLocalProjectResult["configRootStatus"]): string {
  switch (status) {
    case "matches":
      return "matches current repository";
    case "mismatch":
      return "does not match current repository";
    case "missing":
      return "missing";
    case "unreadable":
      return "unreadable";
  }
}

function sessionLockLabel(locks: PurgeLocalProjectResult["sessionLocks"]): string {
  if (locks.status === "not_present") return "database missing";
  if (locks.status === "unreadable") return "database unreadable";
  return `${locks.lockedOrContended} locked or contended`;
}
