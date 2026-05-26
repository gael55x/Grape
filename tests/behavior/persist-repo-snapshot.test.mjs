import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { persistGitRepoSnapshot } from "../../.tmp/build/src/app/index.js";
import {
  applyStorageMigrations,
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createStorageRepositories,
  storageMigrationReferences
} from "../../.tmp/build/src/core/storage/index.js";

const now = "2026-05-24T00:00:00.000Z";

function migrationSources() {
  return storageMigrationReferences.map((migration) => ({
    ...migration,
    sql: readFileSync(
      path.join(process.cwd(), "src/core/storage/migrations", migration.filename),
      "utf8"
    )
  }));
}

function withMigratedDatabase(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-persist-snapshot-db-"));
  const database = new DatabaseSync(path.join(dir, "grape.db"));

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    fn(
      database,
      createStorageRepositories(database),
      createEvidenceStorageRepositories(database),
      createIndexingStorageRepositories(database)
    );
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-persist-snapshot-repo-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    writeFileSync(path.join(dir, ".gitignore"), "ignored.env\n");
    mkdirSync(path.join(dir, ".grape"), { recursive: true });
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, ".grape", "rules.md"), "Never store raw secrets.\n");
    writeFileSync(path.join(dir, "src", "calculateDiscount.ts"), "export const discount = 10;\n");
    writeFileSync(path.join(dir, "package.json"), "{\"name\":\"fixture\"}\n");
    writeFileSync(path.join(dir, "ignored.env"), "SECRET=value\n");
    execGit(dir, ["add", "."]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "initial fixture"
    ]);

    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function execGit(repoPath, args) {
  return execFileSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

test("persist git repo snapshot stores project, repo, snapshot, and worktree state idempotently", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
      const first = persistGitRepoSnapshot({
        database,
        repositories,
        evidenceRepositories,
        indexingRepositories,
        rootPath: repoPath,
        projectId: "project-1",
        repoId: "repo-1",
        now
      });
      const second = persistGitRepoSnapshot({
        database,
        repositories,
        evidenceRepositories,
        indexingRepositories,
        rootPath: repoPath,
        projectId: "project-1",
        repoId: "repo-1",
        now
      });

      assert.deepEqual(first.inserted, {
        project: true,
        repo: true,
        repoSnapshot: true,
        worktreeState: true
      });
      assert.deepEqual(second.inserted, {
        project: false,
        repo: false,
        repoSnapshot: false,
        worktreeState: false
      });
      assert.equal(repositories.projects.get("project-1")?.rootPath, first.snapshot.rootPath);
      assert.equal(repositories.repos.get("repo-1")?.projectId, "project-1");
      assert.equal(repositories.repoSnapshots.get(first.snapshotId)?.snapshotHash, first.snapshot.snapshotHash);
      assert.equal(repositories.worktreeStates.get(first.worktreeStateId)?.dirtyPathsJson, "[]");
      assert.equal(database.prepare("SELECT count(*) AS count FROM repo_snapshots").get().count, 1);
      assert.equal(evidenceRepositories.sources.listBySnapshot(first.snapshotId).length, first.snapshot.files.length);
      assert.equal(second.evidence.sourcesInserted, 0);
      assert.equal(second.index.nodesInserted, 0);
    });
  });
});

test("persist git repo snapshot stores dirty paths without ignored files", () => {
  withGitRepo((repoPath) => {
    writeFileSync(path.join(repoPath, "src", "calculateDiscount.ts"), "export const discount = 20;\n");
    writeFileSync(path.join(repoPath, "ignored.env"), "SECRET=changed\n");

    withMigratedDatabase((_database, repositories, evidenceRepositories, indexingRepositories) => {
      const result = persistGitRepoSnapshot({
        database: _database,
        repositories,
        evidenceRepositories,
        indexingRepositories,
        rootPath: repoPath,
        projectId: "project-1",
        repoId: "repo-1",
        now
      });
      const worktree = repositories.worktreeStates.get(result.worktreeStateId);

      assert.equal(result.snapshot.worktreeStatus, "dirty");
      assert.deepEqual(JSON.parse(worktree?.dirtyPathsJson ?? "[]"), ["src/calculateDiscount.ts"]);
    });
  });
});

test("persist git repo snapshot rolls back when existing project identity conflicts", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
      repositories.projects.insert({
        projectId: "project-1",
        rootPath: "/wrong/root",
        grapeDirPath: "/wrong/root/.grape",
        createdAt: now,
        updatedAt: now
      });

      assert.throws(
        () =>
          persistGitRepoSnapshot({
            database,
            repositories,
            evidenceRepositories,
            indexingRepositories,
            rootPath: repoPath,
            projectId: "project-1",
            repoId: "repo-1",
            now
          }),
        /project root mismatch/
      );
      assert.equal(database.prepare("SELECT count(*) AS count FROM repos").get().count, 0);
      assert.equal(database.prepare("SELECT count(*) AS count FROM repo_snapshots").get().count, 0);
      assert.equal(database.prepare("SELECT count(*) AS count FROM worktree_states").get().count, 0);
    });
  });
});
