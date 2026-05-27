import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

import { isIgnoredByPrivacyPolicy, loadPrivacyIgnorePolicy } from "../security/index.js";
import {
  readGitVisibleFileManifest,
  type SnapshotFileHash,
  type SnapshotFileRejection
} from "./file-manifest.js";

export type WorktreeStatus = "clean" | "dirty" | "unknown";

export interface RepoSnapshot {
  snapshotId: string;
  repoId: string;
  rootPath: string;
  branch: string;
  commit: string;
  worktreeStatus: WorktreeStatus;
  worktreeHash: string;
  snapshotHash: string;
  dirtyPaths: string[];
  files: SnapshotFileHash[];
  rejectedFiles: SnapshotFileRejection[];
  hashAlgorithm: "sha256";
  createdAt: string;
}

export interface RepoSnapshotInput {
  repoId: string;
  rootPath: string;
  branch: string;
  commit: string;
  worktreeStatus: WorktreeStatus;
  worktreeHash: string;
  snapshotHash?: string;
  dirtyPaths?: string[];
  files: SnapshotFileHash[];
  rejectedFiles?: SnapshotFileRejection[];
  createdAt: string;
}

export function createRepoSnapshotShape(input: RepoSnapshotInput): RepoSnapshot {
  const dirtyPaths = [...(input.dirtyPaths ?? [])].sort();
  const files = [...input.files].sort((left, right) => left.path.localeCompare(right.path));
  const rejectedFiles = [...(input.rejectedFiles ?? [])].sort((left, right) =>
    `${left.path}:${left.reason}`.localeCompare(`${right.path}:${right.reason}`)
  );
  const snapshotHash =
    input.snapshotHash ??
    hashStableParts([
      input.repoId,
      normalizeRepoPath(input.rootPath),
      input.branch,
      input.commit,
      input.worktreeStatus,
      input.worktreeHash,
      ...dirtyPaths,
      ...files.map((file) => `${file.path}:${file.sha256}:${file.sourceKind}`),
      ...rejectedFiles.map(rejectedFileHashPart)
    ]);

  return {
    snapshotId: `snapshot:${snapshotHash.slice(0, 24)}`,
    repoId: input.repoId,
    rootPath: input.rootPath,
    branch: input.branch,
    commit: input.commit,
    worktreeStatus: input.worktreeStatus,
    worktreeHash: input.worktreeHash,
    snapshotHash,
    dirtyPaths,
    files,
    rejectedFiles,
    hashAlgorithm: "sha256",
    createdAt: input.createdAt
  };
}

export interface GitRepoSnapshotInput {
  rootPath: string;
  createdAt: string;
  repoId?: string;
  gitBinary?: string;
}

export function resolveGitMetadataPath(
  rootPath: string,
  gitPath: string,
  gitBinary = "git"
): string {
  const resolved = runGit(rootPath, gitBinary, ["rev-parse", "--git-path", gitPath]);
  return path.isAbsolute(resolved) ? normalizeAbsolutePath(resolved) : normalizeAbsolutePath(path.join(rootPath, resolved));
}

export function createGitRepoSnapshot(input: GitRepoSnapshotInput): RepoSnapshot {
  const gitBinary = input.gitBinary ?? "git";
  const rootPath = resolveGitRoot(input.rootPath, gitBinary);
  const repoId = input.repoId ?? `repo:${hashStableParts([normalizeRepoPath(rootPath)]).slice(0, 16)}`;
  const branch = readBranch(rootPath, gitBinary);
  const commit = runGit(rootPath, gitBinary, ["rev-parse", "HEAD"]);
  const privacyPolicy = loadPrivacyIgnorePolicy(rootPath);
  const dirtyPaths = readDirtyPaths(rootPath, gitBinary, privacyPolicy);
  const repoPaths = readGitTrackedAndVisiblePaths(rootPath, gitBinary);
  const gitIgnored = readGitIgnoredPaths(rootPath, gitBinary, repoPaths);
  const fileManifest = readGitVisibleFileManifest({ rootPath, repoPaths, gitIgnored, privacyPolicy });
  const files = fileManifest.files;
  const worktreeStatus: WorktreeStatus = dirtyPaths.length === 0 ? "clean" : "dirty";
  const worktreeHash = hashStableParts([
    branch,
    commit,
    worktreeStatus,
    ...dirtyPaths.map((dirtyPath) => `dirty:${dirtyPath}`),
    ...files.map((file) => `file:${file.path}:${file.sha256}:${file.sourceKind}`),
    ...fileManifest.rejectedFiles.map((file) => `rejected:${rejectedFileHashPart(file)}`)
  ]);

  return createRepoSnapshotShape({
    repoId,
    rootPath,
    branch,
    commit,
    worktreeStatus,
    worktreeHash,
    dirtyPaths,
    files,
    rejectedFiles: fileManifest.rejectedFiles,
    createdAt: input.createdAt
  });
}

function resolveGitRoot(rootPath: string, gitBinary: string): string {
  return normalizeAbsolutePath(runGit(rootPath, gitBinary, ["rev-parse", "--show-toplevel"]));
}

function readBranch(rootPath: string, gitBinary: string): string {
  try {
    return runGit(rootPath, gitBinary, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  } catch {
    return "HEAD";
  }
}

function readDirtyPaths(
  rootPath: string,
  gitBinary: string,
  privacyPolicy: ReturnType<typeof loadPrivacyIgnorePolicy>
): string[] {
  const status = runGit(rootPath, gitBinary, ["status", "--porcelain=v1", "-z"]);
  const entries = status.split("\0").filter(Boolean);
  const dirtyPaths = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const statusCode = entry.slice(0, 2);
    const repoPath = entry.slice(3);
    dirtyPaths.push(normalizeRepoPath(repoPath));

    if (statusCode.includes("R") || statusCode.includes("C")) {
      index += 1;
    }
  }

  const gitIgnored = readGitIgnoredPaths(rootPath, gitBinary, dirtyPaths);
  return [...new Set(dirtyPaths)]
    .filter((repoPath) => !gitIgnored.has(repoPath))
    .filter((repoPath) => !isIgnoredByPrivacyPolicy(repoPath, privacyPolicy))
    .sort();
}

function readGitTrackedAndVisiblePaths(rootPath: string, gitBinary: string): string[] {
  return runGit(rootPath, gitBinary, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .split("\0")
    .filter(Boolean)
    .map(normalizeRepoPath)
    .sort();
}

function readGitIgnoredPaths(rootPath: string, gitBinary: string, repoPaths: readonly string[]): Set<string> {
  if (repoPaths.length === 0) return new Set();

  const result = spawnSync(gitBinary, ["-C", rootPath, "check-ignore", "--no-index", "-z", "--stdin"], {
    input: `${repoPaths.join("\0")}\0`,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"]
  });

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git check-ignore failed: ${result.stderr.trim()}`);
  }

  return new Set(result.stdout.split("\0").filter(Boolean).map(normalizeRepoPath));
}

function rejectedFileHashPart(file: SnapshotFileRejection): string {
  const metadata = file.metadata ?? {};
  return [
    file.path,
    file.reason,
    file.privacyStatus,
    metadata.sha256 ?? "",
    metadata.sizeBytes === undefined ? "" : String(metadata.sizeBytes),
    metadata.sourceKind ?? ""
  ].join(":");
}

function runGit(rootPath: string, gitBinary: string, args: readonly string[]): string {
  return execFileSync(gitBinary, ["-C", rootPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trimEnd();
}

function normalizeAbsolutePath(inputPath: string): string {
  return path.resolve(inputPath);
}

function normalizeRepoPath(inputPath: string): string {
  const normalized = inputPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized === "" || normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`unsafe repo path from git: ${inputPath}`);
  }
  return normalized;
}

function hashStableParts(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(String(part.length));
    hash.update(":");
    hash.update(part);
    hash.update("\n");
  }
  return hash.digest("hex");
}
