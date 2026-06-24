import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";

import type { LocalProjectLayout } from "./config.js";

const knownLocalStateFiles = [
  { key: "configPath", relativePath: ".grape/config.json" },
  { key: "databasePath", relativePath: ".grape/grape.db" },
  { key: "databaseWalPath", relativePath: ".grape/grape.db-wal" },
  { key: "databaseShmPath", relativePath: ".grape/grape.db-shm" }
] as const;

export function resolveExistingGitRoot(rootPathInput: string): string {
  const rootPath = path.resolve(rootPathInput);
  try {
    const output = execFileSync("git", ["-C", rootPath, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return path.resolve(output);
  } catch {
    throw new Error("No Git repository found. Run Grape from a Git worktree, or pass --repo <repo-root>.");
  }
}

export function existingLocalProjectLayout(rootPathInput: string): LocalProjectLayout {
  const rootPath = resolveExistingGitRoot(rootPathInput);
  return {
    rootPath,
    grapeDirPath: path.join(rootPath, ".grape"),
    configPath: path.join(rootPath, ".grape", "config.json"),
    databasePath: path.join(rootPath, ".grape", "grape.db"),
    artifactDirPath: path.join(rootPath, ".grape", "artifacts"),
    createdDirs: []
  };
}

export function assertSafeExistingLocalProjectLayout(layout: LocalProjectLayout): boolean {
  if (!existsSync(layout.grapeDirPath)) return false;

  const stat = lstatSync(layout.grapeDirPath);
  if (stat.isSymbolicLink()) {
    throw new Error("Grape local directory must not be a symlink: .grape");
  }
  if (!stat.isDirectory()) {
    throw new Error("Grape local path must be a directory: .grape");
  }

  const realRoot = realpathSync(layout.rootPath);
  const realGrapeDir = realpathSync(layout.grapeDirPath);
  if (!isInsideOrSame(realRoot, realGrapeDir)) {
    throw new Error("Grape local directory escaped the repository root: .grape");
  }

  assertSafeKnownLocalStateFiles(layout);
  return true;
}

export function assertSafeKnownLocalStateFiles(layout: LocalProjectLayout): void {
  const paths: Record<(typeof knownLocalStateFiles)[number]["key"], string> = {
    configPath: layout.configPath,
    databasePath: layout.databasePath,
    databaseWalPath: path.join(layout.rootPath, ".grape", "grape.db-wal"),
    databaseShmPath: path.join(layout.rootPath, ".grape", "grape.db-shm")
  };

  for (const file of knownLocalStateFiles) {
    const absolutePath = paths[file.key];
    if (!existsSync(absolutePath)) continue;
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      throw new Error(`Grape local state file must not be a symlink: ${file.relativePath}`);
    }
    if (!stat.isFile()) {
      throw new Error(`Grape local state path must be a file: ${file.relativePath}`);
    }
  }
}

function isInsideOrSame(rootPath: string, absolutePath: string): boolean {
  const relativePath = path.relative(rootPath, absolutePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
