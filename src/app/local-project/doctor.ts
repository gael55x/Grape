import { existsSync } from "node:fs";

import { gitExcludeContainsGrape } from "./git-exclude.js";
import { recoveryGuidanceForDoctor } from "./recovery.js";
import { readLocalProjectStatus } from "./status.js";
import type { DiagnosticCheck, LocalProjectDoctor } from "./types.js";

export function doctorLocalProject(rootPath: string): LocalProjectDoctor {
  const status = readLocalProjectStatus(rootPath);
  const checks: DiagnosticCheck[] = [
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

function nodeVersionCheck(): DiagnosticCheck {
  const version = process.versions.node;
  return {
    id: "node_runtime",
    status: isNodeVersionAtLeast(version, 22, 5) ? "pass" : "fail",
    message: isNodeVersionAtLeast(version, 22, 5)
      ? `Node.js ${version} satisfies Grape's current runtime requirement.`
      : `Node.js ${version} is below Grape's current >=22.5 runtime requirement.`
  };
}

function isNodeVersionAtLeast(version: string, major: number, minor: number): boolean {
  const [actualMajor, actualMinor] = version.split(".").map((part) => Number(part));
  return actualMajor > major || (actualMajor === major && actualMinor >= minor);
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
