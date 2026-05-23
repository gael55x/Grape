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
  files: SnapshotFileHash[];
  createdAt: string;
}

export function createRepoSnapshotShape(input: RepoSnapshotInput): RepoSnapshot {
  return {
    snapshotId: `${input.repoId}:${input.branch}:${input.commit}`,
    repoId: input.repoId,
    rootPath: input.rootPath,
    branch: input.branch,
    commit: input.commit,
    worktreeStatus: input.worktreeStatus,
    worktreeHash: input.worktreeHash,
    files: input.files,
    hashAlgorithm: "sha256",
    createdAt: input.createdAt
  };
}
