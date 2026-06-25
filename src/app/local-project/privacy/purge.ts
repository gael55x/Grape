import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmdirSync,
  unlinkSync
} from "node:fs";
import path from "node:path";

import {
  inspectPrivacySessionLocks,
  type PrivacySessionLockStatus,
  type PrivacySessionLockSummary
} from "../../../core/storage/index.js";
import {
  assertSafeExistingLocalProjectLayout,
  existingLocalProjectLayout
} from "../setup/existing-layout.js";

export interface PurgeLocalProjectInput {
  readonly rootPath: string;
  readonly dryRun?: boolean;
  readonly confirm?: boolean;
  readonly now?: string;
}

export interface PurgeLocalProjectCounts {
  readonly files: number;
  readonly directories: number;
  readonly symlinks: number;
  readonly bytes: number;
  readonly specialEntries: number;
}

export type PurgeConfigRootStatus = "missing" | "matches" | "mismatch" | "unreadable";
export type PurgeSessionLockStatus = PrivacySessionLockStatus;
export type PurgeSessionLockSummary = PrivacySessionLockSummary;

export interface PurgeLocalProjectResult {
  readonly formatVersion: 1;
  readonly rootPath: string;
  readonly grapeDirPath: string;
  readonly inspectedAt: string;
  readonly dryRun: boolean;
  readonly applied: boolean;
  readonly confirmationRequired: boolean;
  readonly targetExists: boolean;
  readonly configRootStatus: PurgeConfigRootStatus;
  readonly trackedPathCount: number;
  readonly sessionLocks: PurgeSessionLockSummary;
  readonly planned: PurgeLocalProjectCounts;
  readonly deleted: PurgeLocalProjectCounts;
  readonly notes: readonly string[];
}

interface MutableCounts {
  files: number;
  directories: number;
  symlinks: number;
  bytes: number;
  specialEntries: number;
}

interface ConfigRootInspection {
  readonly status: PurgeConfigRootStatus;
  readonly notes: readonly string[];
}

export function purgeLocalProject(input: PurgeLocalProjectInput): PurgeLocalProjectResult {
  if (input.dryRun && input.confirm) {
    throw new Error("Choose either dryRun or confirm, not both.");
  }

  const inspectedAt = input.now ?? new Date().toISOString();
  const layout = existingLocalProjectLayout(input.rootPath);
  const rootPath = layout.rootPath;
  const grapeDirPath = layout.grapeDirPath;
  const notes: string[] = [
    "Purge deletes the repo-local .grape directory only.",
    "Purge does not delete source files or Git history."
  ];

  if (!existsSync(grapeDirPath)) {
    return {
      formatVersion: 1,
      rootPath,
      grapeDirPath,
      inspectedAt,
      dryRun: true,
      applied: false,
      confirmationRequired: false,
      targetExists: false,
      configRootStatus: "missing",
      trackedPathCount: 0,
      sessionLocks: { status: "not_present", lockedOrContended: 0 },
      planned: emptyCounts(),
      deleted: emptyCounts(),
      notes: [...notes, "No local .grape directory exists."]
    };
  }

  assertSafeExistingLocalProjectLayout(layout);
  const trackedPathCount = trackedGrapePathCount(rootPath);
  if (trackedPathCount > 0) {
    throw new Error("Grape purge refused because .grape contains Git-tracked paths.");
  }

  const configInspection = inspectConfigRoot(rootPath, layout.configPath);
  if (configInspection.status === "mismatch") {
    throw new Error("Grape config root path does not match the current repository path; purge refused.");
  }
  if (input.confirm && configInspection.status !== "matches") {
    throw new Error("Grape purge --confirm requires .grape/config.json to match the current repository path.");
  }

  notes.push(...configInspection.notes);
  const sessionLocks = inspectPrivacySessionLocks(layout.databasePath);
  if (sessionLocks.status === "unreadable") {
    notes.push("Session locks could not be checked because .grape/grape.db could not be read.");
  }
  if (input.confirm && sessionLocks.lockedOrContended > 0) {
    throw new Error("Grape purge refused because local context sessions are locked or contended.");
  }

  const planned = planPurgeTarget(grapeDirPath);
  if (planned.specialEntries > 0) {
    throw new Error("Grape purge refused because .grape contains unsupported local state entries.");
  }

  if (!input.confirm) {
    return {
      formatVersion: 1,
      rootPath,
      grapeDirPath,
      inspectedAt,
      dryRun: true,
      applied: false,
      confirmationRequired: planned.files + planned.directories + planned.symlinks > 0,
      targetExists: true,
      configRootStatus: configInspection.status,
      trackedPathCount,
      sessionLocks,
      planned,
      deleted: emptyCounts(),
      notes: [...notes, "Without --confirm, no data was deleted."]
    };
  }

  const deleted = deletePurgeTarget(grapeDirPath);
  return {
    formatVersion: 1,
    rootPath,
    grapeDirPath,
    inspectedAt,
    dryRun: false,
    applied: true,
    confirmationRequired: false,
    targetExists: true,
    configRootStatus: configInspection.status,
    trackedPathCount,
    sessionLocks,
    planned,
    deleted,
    notes
  };
}

function inspectConfigRoot(rootPath: string, configPath: string): ConfigRootInspection {
  if (!existsSync(configPath)) {
    return { status: "missing", notes: ["No .grape/config.json was found."] };
  }

  try {
    const stat = lstatSync(configPath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      return {
        status: "unreadable",
        notes: [".grape/config.json was not read because it is not a regular file."]
      };
    }

    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
      readonly project?: { readonly rootPath?: unknown };
    };
    const configRoot = parsed.project?.rootPath;
    if (typeof configRoot !== "string") {
      return {
        status: "unreadable",
        notes: [".grape/config.json did not contain a readable project root."]
      };
    }
    if (path.resolve(configRoot) !== rootPath) {
      return { status: "mismatch", notes: [] };
    }
    return { status: "matches", notes: [".grape/config.json matches the current Git root."] };
  } catch {
    return {
      status: "unreadable",
      notes: [".grape/config.json could not be parsed. Purge is limited to the repo-local .grape directory."]
    };
  }
}

function trackedGrapePathCount(rootPath: string): number {
  const output = execFileSync("git", ["-C", rootPath, "ls-files", "-z", "--", ".grape"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return output.split("\0").filter(Boolean).length;
}

function planPurgeTarget(grapeDirPath: string): PurgeLocalProjectCounts {
  const counts = mutableCounts();
  visitPurgeTarget(grapeDirPath, grapeDirPath, counts, false);
  return freezeCounts(counts);
}

function deletePurgeTarget(grapeDirPath: string): PurgeLocalProjectCounts {
  const counts = mutableCounts();
  visitPurgeTarget(grapeDirPath, grapeDirPath, counts, true);
  return freezeCounts(counts);
}

function visitPurgeTarget(
  grapeDirPath: string,
  entryPath: string,
  counts: MutableCounts,
  deleteEntries: boolean
): void {
  assertInsideDirectory(grapeDirPath, entryPath);
  const stat = lstatSync(entryPath);

  if (stat.isDirectory()) {
    assertRealDirectoryInside(grapeDirPath, entryPath);
    counts.directories += 1;
    for (const name of readdirSync(entryPath).sort()) {
      visitPurgeTarget(grapeDirPath, path.join(entryPath, name), counts, deleteEntries);
    }
    if (deleteEntries) rmdirSync(entryPath);
    return;
  }

  counts.bytes += stat.size;
  if (stat.isSymbolicLink()) {
    counts.symlinks += 1;
    if (deleteEntries) unlinkSync(entryPath);
    return;
  }

  if (stat.isFile()) {
    counts.files += 1;
    if (deleteEntries) unlinkSync(entryPath);
    return;
  }

  counts.specialEntries += 1;
}

function assertRealDirectoryInside(grapeDirPath: string, entryPath: string): void {
  const realGrapeDir = realpathSync(grapeDirPath);
  const realEntry = realpathSync(entryPath);
  if (!isInsideOrSame(realGrapeDir, realEntry)) {
    throw new Error("Grape purge refused because a local state directory escaped .grape.");
  }
}

function assertInsideDirectory(directoryPath: string, entryPath: string): void {
  const normalizedDirectory = path.resolve(directoryPath);
  const normalizedEntry = path.resolve(entryPath);
  if (!isInsideOrSame(normalizedDirectory, normalizedEntry)) {
    throw new Error("Grape purge refused because a local state path escaped .grape.");
  }
}

function isInsideOrSame(rootPath: string, absolutePath: string): boolean {
  const relativePath = path.relative(rootPath, absolutePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function mutableCounts(): MutableCounts {
  return {
    files: 0,
    directories: 0,
    symlinks: 0,
    bytes: 0,
    specialEntries: 0
  };
}

function emptyCounts(): PurgeLocalProjectCounts {
  return freezeCounts(mutableCounts());
}

function freezeCounts(counts: MutableCounts): PurgeLocalProjectCounts {
  return {
    files: counts.files,
    directories: counts.directories,
    symlinks: counts.symlinks,
    bytes: counts.bytes,
    specialEntries: counts.specialEntries
  };
}
