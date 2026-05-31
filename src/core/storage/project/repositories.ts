import type { DatabaseSync } from "node:sqlite";

import type {
  ProjectRecord,
  RepoRecord,
  RepoSnapshotRecord,
  StorageRepositories,
  WorktreeStateRecord
} from "../repositories.js";

export function createProjectStorageRepositories(
  database: DatabaseSync
): Pick<StorageRepositories, "projects" | "repos" | "repoSnapshots" | "worktreeStates"> {
  return {
    projects: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO projects",
              "(project_id, root_path, grape_dir_path, created_at, updated_at)",
              "VALUES (?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(record.projectId, record.rootPath, record.grapeDirPath, record.createdAt, record.updatedAt);
      },
      get(projectId) {
        return mapProject(
          database
            .prepare("SELECT * FROM projects WHERE project_id = ?")
            .get(projectId) as Record<string, unknown> | undefined
        );
      }
    },
    repos: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO repos",
              "(repo_id, project_id, vcs_type, root_path, normalized_root_path, created_at, updated_at)",
              "VALUES (?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.repoId,
            record.projectId,
            record.vcsType,
            record.rootPath,
            record.normalizedRootPath,
            record.createdAt,
            record.updatedAt
          );
      },
      get(repoId) {
        return mapRepo(
          database
            .prepare("SELECT * FROM repos WHERE repo_id = ?")
            .get(repoId) as Record<string, unknown> | undefined
        );
      }
    },
    repoSnapshots: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO repo_snapshots",
              "(snapshot_id, repo_id, branch, commit_sha, worktree_hash, snapshot_hash, dirty_state, created_at)",
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(
            record.snapshotId,
            record.repoId,
            record.branch,
            record.commitSha,
            record.worktreeHash,
            record.snapshotHash,
            record.dirtyState,
            record.createdAt
          );
      },
      get(snapshotId) {
        return mapRepoSnapshot(
          database
            .prepare("SELECT * FROM repo_snapshots WHERE snapshot_id = ?")
            .get(snapshotId) as Record<string, unknown> | undefined
        );
      }
    },
    worktreeStates: {
      insert(record) {
        database
          .prepare(
            [
              "INSERT INTO worktree_states",
              "(worktree_state_id, snapshot_id, state, dirty_paths_json, created_at)",
              "VALUES (?, ?, ?, ?, ?)"
            ].join(" ")
          )
          .run(record.worktreeStateId, record.snapshotId, record.state, record.dirtyPathsJson, record.createdAt);
      },
      get(worktreeStateId) {
        return mapWorktreeState(
          database
            .prepare("SELECT * FROM worktree_states WHERE worktree_state_id = ?")
            .get(worktreeStateId) as Record<string, unknown> | undefined
        );
      }
    }
  };
}

function mapProject(row: Record<string, unknown> | undefined): ProjectRecord | undefined {
  if (!row) return undefined;
  return {
    projectId: stringField(row, "project_id"),
    rootPath: stringField(row, "root_path"),
    grapeDirPath: stringField(row, "grape_dir_path"),
    createdAt: stringField(row, "created_at"),
    updatedAt: stringField(row, "updated_at")
  };
}

function mapRepo(row: Record<string, unknown> | undefined): RepoRecord | undefined {
  if (!row) return undefined;
  return {
    repoId: stringField(row, "repo_id"),
    projectId: stringField(row, "project_id"),
    vcsType: stringField(row, "vcs_type"),
    rootPath: stringField(row, "root_path"),
    normalizedRootPath: stringField(row, "normalized_root_path"),
    createdAt: stringField(row, "created_at"),
    updatedAt: stringField(row, "updated_at")
  };
}

function mapRepoSnapshot(row: Record<string, unknown> | undefined): RepoSnapshotRecord | undefined {
  if (!row) return undefined;
  return {
    snapshotId: stringField(row, "snapshot_id"),
    repoId: stringField(row, "repo_id"),
    branch: stringField(row, "branch"),
    commitSha: stringField(row, "commit_sha"),
    worktreeHash: stringField(row, "worktree_hash"),
    snapshotHash: stringField(row, "snapshot_hash"),
    dirtyState: stringField(row, "dirty_state") as RepoSnapshotRecord["dirtyState"],
    createdAt: stringField(row, "created_at")
  };
}

function mapWorktreeState(row: Record<string, unknown> | undefined): WorktreeStateRecord | undefined {
  if (!row) return undefined;
  return {
    worktreeStateId: stringField(row, "worktree_state_id"),
    snapshotId: stringField(row, "snapshot_id"),
    state: stringField(row, "state") as WorktreeStateRecord["state"],
    dirtyPathsJson: stringField(row, "dirty_paths_json"),
    createdAt: stringField(row, "created_at")
  };
}

function stringField(row: Record<string, unknown>, key: string): string {
  return String(row[key]);
}
