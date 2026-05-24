import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";

export type WorktreeStatus = "clean" | "dirty" | "unknown";

export interface SnapshotFileHash {
  path: string;
  sha256: string;
  sourceKind: "source" | "test" | "rule" | "config" | "package" | "doc";
}

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
  createdAt: string;
}

export function createRepoSnapshotShape(input: RepoSnapshotInput): RepoSnapshot {
  const dirtyPaths = [...(input.dirtyPaths ?? [])].sort();
  const files = [...input.files].sort((left, right) => left.path.localeCompare(right.path));
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
      ...files.map((file) => `${file.path}:${file.sha256}:${file.sourceKind}`)
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

export function createGitRepoSnapshot(input: GitRepoSnapshotInput): RepoSnapshot {
  const gitBinary = input.gitBinary ?? "git";
  const rootPath = resolveGitRoot(input.rootPath, gitBinary);
  const repoId = input.repoId ?? `repo:${hashStableParts([normalizeRepoPath(rootPath)]).slice(0, 16)}`;
  const branch = readBranch(rootPath, gitBinary);
  const commit = runGit(rootPath, gitBinary, ["rev-parse", "HEAD"]);
  const dirtyPaths = readDirtyPaths(rootPath, gitBinary);
  const files = readGitVisibleFileHashes(rootPath, gitBinary);
  const worktreeStatus: WorktreeStatus = dirtyPaths.length === 0 ? "clean" : "dirty";
  const worktreeHash = hashStableParts([
    branch,
    commit,
    worktreeStatus,
    ...dirtyPaths.map((dirtyPath) => `dirty:${dirtyPath}`),
    ...files.map((file) => `file:${file.path}:${file.sha256}:${file.sourceKind}`)
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

function readDirtyPaths(rootPath: string, gitBinary: string): string[] {
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

  return [...new Set(dirtyPaths)].sort();
}

function readGitVisibleFileHashes(rootPath: string, gitBinary: string): SnapshotFileHash[] {
  return runGit(rootPath, gitBinary, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .split("\0")
    .filter(Boolean)
    .map(normalizeRepoPath)
    .sort()
    .flatMap((repoPath): SnapshotFileHash[] => {
      const absolutePath = path.join(rootPath, repoPath);

      try {
        const stat = lstatSync(absolutePath);
        if (!stat.isFile() && !stat.isSymbolicLink()) return [];

        const bytes = stat.isSymbolicLink()
          ? Buffer.from(`symlink:${readlinkSync(absolutePath)}`)
          : readFileSync(absolutePath);

        return [
          {
            path: repoPath,
            sha256: sha256(bytes),
            sourceKind: classifySourceKind(repoPath)
          }
        ];
      } catch {
        return [];
      }
    });
}

function classifySourceKind(repoPath: string): SnapshotFileHash["sourceKind"] {
  const normalized = repoPath.toLowerCase();
  const basename = path.posix.basename(normalized);

  if (basename === "package.json" || basename.endsWith("-lock.json") || basename.endsWith(".lock")) {
    return "package";
  }
  if (basename === "agents.md" || normalized.startsWith(".grape/")) {
    return "rule";
  }
  if (normalized.includes(".test.") || normalized.includes(".spec.") || normalized.includes("__tests__/")) {
    return "test";
  }
  if (
    basename.startsWith("tsconfig") ||
    basename.includes("config") ||
    normalized.startsWith(".github/") ||
    normalized.startsWith(".vscode/")
  ) {
    return "config";
  }
  if (basename.endsWith(".md") || normalized.startsWith("docs/")) {
    return "doc";
  }
  return "source";
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

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
