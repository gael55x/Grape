import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, renderProblems, renderReasonCounts, repoOutputOptions, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";

export async function runSync(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--json", "--repo"]));
  if (flag) {
    writeError(`Unsupported option for grape sync: ${flag}`);
    return exitCodes.usage;
  }

  try {
    const rootPath = repoPath(parsed);
    const outputOptions = repoOutputOptions(rootPath);
    const { syncLocalProject } = await import("../../app/local-project/setup/sync.js");
    const result = syncLocalProject({ rootPath });

    if (parsed.flags.has("--json")) {
      writeJson(result, outputOptions);
      return exitCodes.ok;
    }

    write([
      "Grape local context synced.",
      "",
      `Project: ${result.projectId}`,
      `Repo: ${result.repoId}`,
      `Snapshot: ${result.snapshotId}`,
      `Worktree state: ${result.worktreeStateId}`,
      `Branch: ${result.branch}`,
      `Head: ${result.headCommit}`,
      `Worktree: ${result.dirtyWorktree ? "dirty" : "clean"}`,
      `Config: ${result.configStatus}`,
      result.configBackupPath ? `Config backup: ${result.configBackupPath}` : undefined,
      `Database: ${result.databasePath}`,
      result.databaseBackupPath ? `Database backup: ${result.databaseBackupPath}` : undefined,
      `Migrations applied: ${result.migrationsApplied.length === 0 ? "none" : result.migrationsApplied.join(", ")}`,
      "",
      "Scan diagnostics:",
      `  Visible files: ${result.scan.visibleFileCount}`,
      `  Rejected files: ${result.scan.rejectedFileCount}`,
      `  Rejection reasons: ${renderReasonCounts(result.scan.rejectionReasonCounts)}`,
      ...renderProblems("Recovery", result.recoveryGuidance)
    ].filter((line): line is string => line !== undefined).join("\n"), outputOptions);

    return exitCodes.ok;
  } catch (error) {
    writeError(`grape sync failed: ${errorMessage(error)}`, repoOutputOptions(repoPath(parsed)));
    return exitCodes.storage;
  }
}
