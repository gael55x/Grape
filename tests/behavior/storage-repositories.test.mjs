import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  applyStorageMigrations,
  createStorageRepositories,
  storageMigrationReferences
} from "../../.tmp/build/src/core/storage/index.js";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-repositories-"));
  const database = new DatabaseSync(path.join(dir, "grape.db"));

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    fn(database, createStorageRepositories(database));
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function insertBaseGraph(repositories, overrides = {}) {
  repositories.projects.insert({
    projectId: overrides.projectId ?? "project-1",
    rootPath: "/repo",
    grapeDirPath: "/repo/.grape",
    createdAt: now,
    updatedAt: now
  });
  repositories.repos.insert({
    repoId: overrides.repoId ?? "repo-1",
    projectId: overrides.projectId ?? "project-1",
    vcsType: "git",
    rootPath: "/repo",
    normalizedRootPath: "/repo",
    createdAt: now,
    updatedAt: now
  });
  repositories.repoSnapshots.insert({
    snapshotId: overrides.snapshotId ?? "snapshot-1",
    repoId: overrides.repoId ?? "repo-1",
    branch: "main",
    commitSha: "abc123",
    worktreeHash: hashA,
    snapshotHash: hashB,
    dirtyState: "clean",
    createdAt: now
  });
  repositories.worktreeStates.insert({
    worktreeStateId: overrides.worktreeStateId ?? "worktree-1",
    snapshotId: overrides.snapshotId ?? "snapshot-1",
    state: "clean",
    dirtyPathsJson: "[]",
    createdAt: now
  });
}

function insertSession(repositories, sessionId) {
  repositories.contextSessions.insert({
    sessionId,
    projectId: "project-1",
    repoId: "repo-1",
    repoSnapshotId: "snapshot-1",
    worktreeStateId: "worktree-1",
    agentName: "codex",
    agentSessionId: sessionId,
    taskId: "task-1",
    taskType: "analysis",
    branchName: "main",
    headCommitSha: "abc123",
    status: "active",
    lockStatus: "locked",
    lockToken: `lock-${sessionId}`,
    startedAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now
  });
}

function insertArtifact(repositories, artifactId, sessionId) {
  repositories.contextArtifacts.insert({
    artifactId,
    sessionId,
    snapshotId: "snapshot-1",
    artifactHash: hashA,
    dependencyManifestHash: hashB,
    taskType: "analysis",
    riskOverlaysJson: "[]",
    warningsJson: "[]",
    unsafeReasonsJson: "[]",
    createdAt: now
  });
}

function sentItem(overrides = {}) {
  return {
    sentItemId: overrides.sentItemId ?? "sent-1",
    sessionId: overrides.sessionId ?? "session-1",
    artifactId: overrides.artifactId ?? "artifact-1",
    sectionId: "section-1",
    taskId: "task-1",
    itemKind: "claim",
    itemRef: "claim-1",
    itemHash: hashA,
    contentHash: hashA,
    branchName: "main",
    commitSha: "abc123",
    dependencyManifestHash: hashB,
    wasPinned: false,
    lastDiffState: "NEW",
    firstSentAt: now,
    lastSentAt: now,
    sendCount: 1,
    tokenCount: 42
  };
}

function omittedItem(overrides = {}) {
  return {
    omittedItemId: overrides.omittedItemId ?? "omitted-1",
    sessionId: overrides.sessionId ?? "session-1",
    artifactId: overrides.artifactId ?? "artifact-1",
    sectionId: "section-1",
    itemKind: "claim",
    itemRef: "claim-1",
    itemHash: hashA,
    contentHash: hashA,
    reasonOmitted: "unchanged_restorable",
    canRestore: true,
    restoreId: "restore-1",
    restoreCommand: "grape restore restore-1",
    omittedAt: now
  };
}

test("storage repositories persist session, artifact, dependency, sent, and omitted ledgers", () => {
  withMigratedDatabase((_database, repositories) => {
    insertBaseGraph(repositories);
    insertSession(repositories, "session-1");
    insertArtifact(repositories, "artifact-1", "session-1");

    repositories.contextDependencies.insert({
      dependencyId: "dep-1",
      artifactId: "artifact-1",
      dependencyKind: "file",
      dependencyRef: "src/calculateDiscount.ts",
      dependencyHash: hashA,
      scopeJson: "{\"branch\":\"main\"}",
      createdAt: now
    });
    repositories.contextSentItems.insert(sentItem());
    repositories.omittedContextItems.insert(omittedItem());

    assert.equal(repositories.contextSessions.get("session-1")?.headCommitSha, "abc123");
    assert.equal(repositories.contextArtifacts.get("artifact-1")?.dependencyManifestHash, hashB);
    assert.deepEqual(
      repositories.contextDependencies.listByArtifact("artifact-1").map((item) => item.dependencyId),
      ["dep-1"]
    );
    assert.deepEqual(
      repositories.contextSentItems.listBySession("session-1").map((item) => item.sentItemId),
      ["sent-1"]
    );
    assert.deepEqual(
      repositories.omittedContextItems.listBySession("session-1").map((item) => item.restoreId),
      ["restore-1"]
    );
  });
});

test("storage repositories keep sent and omitted ledgers session scoped", () => {
  withMigratedDatabase((_database, repositories) => {
    insertBaseGraph(repositories);
    insertSession(repositories, "session-1");
    insertSession(repositories, "session-2");
    insertArtifact(repositories, "artifact-1", "session-1");
    insertArtifact(repositories, "artifact-2", "session-2");

    repositories.contextSentItems.insert(sentItem({ sentItemId: "sent-1", sessionId: "session-1" }));
    repositories.contextSentItems.insert(
      sentItem({ sentItemId: "sent-2", sessionId: "session-2", artifactId: "artifact-2" })
    );
    repositories.omittedContextItems.insert(omittedItem({ omittedItemId: "omitted-1", sessionId: "session-1" }));
    repositories.omittedContextItems.insert(
      omittedItem({ omittedItemId: "omitted-2", sessionId: "session-2", artifactId: "artifact-2" })
    );

    assert.deepEqual(
      repositories.contextSentItems.listBySession("session-1").map((item) => item.sentItemId),
      ["sent-1"]
    );
    assert.deepEqual(
      repositories.omittedContextItems.listBySession("session-2").map((item) => item.omittedItemId),
      ["omitted-2"]
    );
  });
});

test("storage repositories fail closed on invalid sent item references", () => {
  withMigratedDatabase((_database, repositories) => {
    assert.throws(
      () => repositories.contextSentItems.insert(sentItem()),
      /constraint failed/i
    );
  });
});
