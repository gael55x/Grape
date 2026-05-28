import { existsSync } from "node:fs";

import { describeNodeRuntimeRequirement } from "../../shared/index.js";
import { gitExcludeContainsGrape } from "./git-exclude.js";
import { recoveryGuidanceForDoctor } from "./recovery.js";
import { readLocalProjectStatus } from "./status.js";
import type { DiagnosticCheck, LocalProjectDoctor, LocalProjectStatus } from "./types.js";

export interface DoctorLocalProjectOptions {
  readonly privacyOnly?: boolean;
}

export function doctorLocalProject(
  rootPath: string,
  options: DoctorLocalProjectOptions = {}
): LocalProjectDoctor {
  const status = readLocalProjectStatus(rootPath);
  const checks = options.privacyOnly ? privacyChecks(status) : setupChecks(status);

  for (const error of status.errors) {
    checks.push({ id: "status_error", status: "fail", message: error });
  }

  return {
    rootPath: status.rootPath,
    overallStatus: checks.some((check) => check.status === "fail")
      ? "fail"
      : checks.some((check) => check.status === "warn")
        ? "warn"
        : "pass",
    checks,
    recoveryGuidance: recoveryGuidanceForDoctor(status, checks)
  };
}

function setupChecks(status: LocalProjectStatus): DiagnosticCheck[] {
  return [
    nodeVersionCheck(),
    {
      id: "git_repo",
      status: status.branch ? "pass" : "fail",
      message: status.branch
        ? `Git repository detected on ${status.branch}.`
        : "No readable Git repository was detected.",
      detail: status.headCommit
    },
    {
      id: "local_layout",
      status: existsSync(status.grapeDirPath) ? "pass" : "fail",
      message: existsSync(status.grapeDirPath)
        ? "Local .grape directory exists."
        : "Run grape init --connect to create local project state."
    },
    {
      id: "config",
      status: status.config ? "pass" : "fail",
      message: status.config
        ? "Local Grape config is readable."
        : "Local .grape/config.json is missing or invalid."
    },
    {
      id: "database",
      status: status.databaseExists ? "pass" : "fail",
      message: status.databaseExists
        ? "Local SQLite database exists."
        : "Local .grape/grape.db is missing."
    },
    {
      id: "migrations",
      status: status.pendingMigrations.length === 0 && status.databaseExists ? "pass" : "fail",
      message:
        status.pendingMigrations.length === 0 && status.databaseExists
          ? "Storage migrations are current."
          : `Pending migrations: ${status.pendingMigrations.join(", ") || "unknown"}.`
    },
    {
      id: "worktree",
      status: status.dirtyWorktree ? "warn" : "pass",
      message: status.dirtyWorktree
        ? "Worktree is dirty; context will include dirty-scope warnings."
        : "Worktree is clean."
    },
    privacyCheck(status.rootPath)
  ];
}

function privacyChecks(status: LocalProjectStatus): DiagnosticCheck[] {
  const ignoredOrPrivateCount =
    status.scan.rejectionReasonCounts.git_ignored + status.scan.rejectionReasonCounts.privacy_ignored;

  return [
    {
      id: "local_first",
      status: "pass",
      message: "Grape runs locally and does not use cloud sync, telemetry, or remote embeddings by default."
    },
    privacyCheck(status.rootPath),
    {
      id: "scan_rejections",
      status: status.scan.rejectedFileCount > 0 ? "warn" : "pass",
      message:
        status.scan.rejectedFileCount > 0
          ? `Scanner rejected ${status.scan.rejectedFileCount} visible path(s) before indexing.`
          : "Current scan has no visible rejected paths.",
      detail: renderReasonCounts(status.scan.rejectionReasonCounts)
    },
    {
      id: "ignored_private_inputs",
      status: "pass",
      message:
        ignoredOrPrivateCount > 0
          ? "Ignored/private paths were excluded and recorded as metadata-only rejections."
          : "No Git-ignored or Grape-private visible tracked paths were detected in the current scan.",
      detail: `git_ignored=${status.scan.rejectionReasonCounts.git_ignored}, privacy_ignored=${status.scan.rejectionReasonCounts.privacy_ignored}`
    },
    {
      id: "artifact_secret_scan",
      status: "pass",
      message: "Compile output is blocked if the artifact-level secret scan finds raw secret-looking content."
    }
  ];
}

function nodeVersionCheck(): DiagnosticCheck {
  const runtime = describeNodeRuntimeRequirement();
  return {
    id: "node_runtime",
    status: runtime.supported ? "pass" : "fail",
    message: runtime.supported
      ? `Node.js ${runtime.actualVersion} satisfies Grape's current runtime requirement.`
      : `Node.js ${runtime.actualVersion} is below Grape's current >=${runtime.minimumVersion} runtime requirement.`
  };
}

function privacyCheck(rootPath: string): DiagnosticCheck {
  const excludesGrape = gitExcludeContainsGrape(rootPath);
  if (excludesGrape === undefined) {
    return {
      id: "privacy_local_exclude",
      status: "warn",
      message: "Could not inspect local Git exclude rules."
    };
  }

  return {
    id: "privacy_local_exclude",
    status: excludesGrape ? "pass" : "warn",
    message: excludesGrape
      ? "Local .grape state is excluded through .git/info/exclude."
      : "Run grape init --connect to add .grape/ to .git/info/exclude."
  };
}

function renderReasonCounts(counts: Readonly<Record<string, number>>): string {
  const activeCounts = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}=${count}`);
  return activeCounts.length === 0 ? "none" : activeCounts.join(", ");
}
