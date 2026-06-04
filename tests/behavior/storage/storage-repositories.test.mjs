import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  applyStorageMigrations,
  createStorageRepositories,
  runStorageTransaction,
  storageMigrationReferences
} from "../../../.tmp/build/src/core/storage/index.js";

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

function withMigratedDatabaseFile(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-repositories-"));
  const databasePath = path.join(dir, "grape.db");
  const database = new DatabaseSync(databasePath);

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    database.close();
    fn(databasePath);
  } finally {
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

function insertSession(repositories, sessionId, overrides = {}) {
  const lockToken = Object.hasOwn(overrides, "lockToken")
    ? overrides.lockToken
    : `lock-${sessionId}`;

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
    status: overrides.status ?? "active",
    lockStatus: overrides.lockStatus ?? "locked",
    lockToken,
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
    sectionId: overrides.sectionId ?? "section-1",
    taskId: "task-1",
    itemKind: overrides.itemKind ?? "claim",
    itemRef: "claim-1",
    itemHash: hashA,
    contentHash: hashA,
    branchName: overrides.branchName ?? "main",
    commitSha: overrides.commitSha ?? "abc123",
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
  const restoreId = Object.hasOwn(overrides, "restoreId") ? overrides.restoreId : "restore-1";
  const restoreCommand = Object.hasOwn(overrides, "restoreCommand")
    ? overrides.restoreCommand
    : "grape restore restore-1";

  return {
    omittedItemId: overrides.omittedItemId ?? "omitted-1",
    sessionId: overrides.sessionId ?? "session-1",
    artifactId: overrides.artifactId ?? "artifact-1",
    sectionId: "section-1",
    itemKind: "claim",
    itemRef: "claim-1",
    itemHash: hashA,
    contentHash: hashA,
    branchName: "main",
    commitSha: "abc123",
    dependencyManifestHash: hashB,
    lastDiffState: "OMIT_UNCHANGED",
    reasonOmitted: "unchanged_restorable",
    canRestore: true,
    restoreId,
    restoreCommand,
    omittedAt: now,
    sendCount: 1,
    tokenCount: 42
  };
}

function packItem(overrides = {}) {
  return {
    packItemId: overrides.packItemId ?? "pack-1",
    sessionId: overrides.sessionId ?? "session-1",
    artifactId: overrides.artifactId ?? "artifact-1",
    sectionId: overrides.sectionId ?? "section-1",
    diffState: overrides.diffState ?? "NEW",
    itemKind: overrides.itemKind ?? "claim",
    itemRef: "claim-1",
    contentHash: hashA,
    tokenCount: 42,
    pinned: false,
    safetyCritical: false,
    invalidatesSentItemId: overrides.invalidatesSentItemId,
    inputRefsJson: "[\"dep-1\"]",
    createdAt: now
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
    repositories.contextPackItems.insert(packItem());
    repositories.sessionEvents.insert({
      eventId: "event-1",
      sessionId: "session-1",
      eventType: "lock_acquired",
      reason: "test",
      metadataJson: "{}",
      createdAt: now
    });

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
    assert.deepEqual(
      repositories.contextPackItems.listBySession("session-1").map((item) => item.packItemId),
      ["pack-1"]
    );
    assert.deepEqual(
      repositories.sessionEvents.listBySession("session-1").map((item) => item.eventId),
      ["event-1"]
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

test("storage repositories expose scoped active ledger query helpers", () => {
  withMigratedDatabase((_database, repositories) => {
    insertBaseGraph(repositories);
    insertSession(repositories, "session-1");
    insertArtifact(repositories, "artifact-1", "session-1");

    repositories.contextSentItems.insert(sentItem({ sentItemId: "sent-1" }));
    repositories.contextSentItems.insert(sentItem({
      sentItemId: "sent-2",
      itemKind: "compression_artifact",
      sectionId: "compression-orientation"
    }));
    repositories.contextSentItems.insert(sentItem({
      sentItemId: "sent-3",
      branchName: "feature/context",
      commitSha: "def456",
      sectionId: "feature-section"
    }));
    repositories.contextPackItems.insert(packItem({ packItemId: "sent-1" }));
    repositories.contextPackItems.insert(packItem({
      packItemId: "pack-invalidate-sent-1",
      diffState: "INVALIDATE_PREVIOUS",
      itemKind: "invalidation",
      invalidatesSentItemId: "sent-1"
    }));

    assert.deepEqual(
      repositories.contextSentItems
        .listBySessionScope({
          sessionId: "session-1",
          branchName: "main",
          commitSha: "abc123",
          excludedKind: "compression_artifact"
        })
        .map((item) => item.sentItemId),
      ["sent-1"]
    );
    assert.deepEqual(
      repositories.contextSentItems
        .listBySessionWithoutKind("session-1", "compression_artifact")
        .map((item) => item.sentItemId),
      ["sent-1", "sent-3"]
    );
    assert.deepEqual(
      repositories.contextPackItems.listSentPayloadsBySession("session-1").map((item) => item.packItemId),
      ["sent-1"]
    );
    assert.deepEqual(
      repositories.contextPackItems.listInvalidatedSentItemIdsBySession("session-1"),
      ["sent-1"]
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

test("storage repositories reject cross-session artifact ledger rows", () => {
  withMigratedDatabase((_database, repositories) => {
    insertBaseGraph(repositories);
    insertSession(repositories, "session-1");
    insertSession(repositories, "session-2");
    insertArtifact(repositories, "artifact-1", "session-1");
    insertArtifact(repositories, "artifact-2", "session-2");

    assert.throws(
      () => repositories.contextSentItems.insert(sentItem({ sessionId: "session-1", artifactId: "artifact-2" })),
      /constraint failed/i
    );
    assert.throws(
      () =>
        repositories.omittedContextItems.insert(
          omittedItem({ omittedItemId: "omitted-cross", sessionId: "session-1", artifactId: "artifact-2" })
        ),
      /constraint failed/i
    );
    assert.throws(
      () =>
        repositories.contextPackItems.insert(
          packItem({ packItemId: "pack-cross", sessionId: "session-1", artifactId: "artifact-2" })
        ),
      /constraint failed/i
    );
  });
});

test("storage repositories require restore metadata for restorable omissions", () => {
  withMigratedDatabase((_database, repositories) => {
    insertBaseGraph(repositories);
    insertSession(repositories, "session-1");
    insertArtifact(repositories, "artifact-1", "session-1");

    assert.throws(
      () =>
        repositories.omittedContextItems.insert(
          omittedItem({ restoreId: undefined, restoreCommand: undefined })
        ),
      /constraint failed/i
    );
  });
});

test("storage repository creation applies sqlite pragmas on reopened connections", () => {
  withMigratedDatabaseFile((databasePath) => {
    const database = new DatabaseSync(databasePath);

    try {
      const repositories = createStorageRepositories(database);
      assert.equal(database.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
      assert.throws(
        () => repositories.contextSentItems.insert(sentItem()),
        /constraint failed/i
      );
    } finally {
      database.close();
    }
  });
});

test("storage session locks coordinate with compare-and-set updates", () => {
  withMigratedDatabaseFile((databasePath) => {
    const first = new DatabaseSync(databasePath);
    const second = new DatabaseSync(databasePath);

    try {
      const firstRepo = createStorageRepositories(first);
      const secondRepo = createStorageRepositories(second);
      insertBaseGraph(firstRepo);
      insertSession(firstRepo, "session-1", { lockStatus: "unlocked", lockToken: undefined });

      assert.equal(firstRepo.contextSessions.acquireLock({ sessionId: "session-1", lockToken: "token-a", now }), true);
      assert.equal(secondRepo.contextSessions.acquireLock({ sessionId: "session-1", lockToken: "token-b", now }), false);
      assert.equal(secondRepo.contextSessions.renewLock({ sessionId: "session-1", lockToken: "token-b", now }), false);
      assert.equal(firstRepo.contextSessions.renewLock({ sessionId: "session-1", lockToken: "token-a", now }), true);
      assert.equal(secondRepo.contextSessions.releaseLock({ sessionId: "session-1", lockToken: "token-b", now }), false);
      assert.equal(firstRepo.contextSessions.releaseLock({ sessionId: "session-1", lockToken: "token-a", now }), true);
      assert.equal(secondRepo.contextSessions.acquireLock({ sessionId: "session-1", lockToken: "token-b", now }), true);
    } finally {
      first.close();
      second.close();
    }
  });
});

test("storage context sessions update compile state without changing lock ownership", () => {
  withMigratedDatabase((_database, repositories) => {
    insertBaseGraph(repositories);
    insertSession(repositories, "session-1", { lockStatus: "locked", lockToken: "token-a" });
    repositories.repoSnapshots.insert({
      snapshotId: "snapshot-feature",
      repoId: "repo-1",
      branch: "feature/context",
      commitSha: "def456",
      worktreeHash: hashB,
      snapshotHash: hashA,
      dirtyState: "clean",
      createdAt: now
    });
    repositories.worktreeStates.insert({
      worktreeStateId: "worktree-feature",
      snapshotId: "snapshot-feature",
      state: "clean",
      dirtyPathsJson: "[]",
      createdAt: now
    });

    assert.equal(
      repositories.contextSessions.updateCompileState({
        sessionId: "session-1",
        repoSnapshotId: "snapshot-feature",
        worktreeStateId: "worktree-feature",
        branchName: "feature/context",
        baseCommitSha: "def456",
        headCommitSha: "def456",
        status: "active",
        now
      }),
      true
    );

    const session = repositories.contextSessions.get("session-1");
    assert.equal(session?.branchName, "feature/context");
    assert.equal(session?.baseCommitSha, "def456");
    assert.equal(session?.headCommitSha, "def456");
    assert.equal(session?.lockStatus, "locked");
    assert.equal(session?.lockToken, "token-a");
  });
});

test("storage transactions roll back multi-record writes", () => {
  withMigratedDatabase((database, repositories) => {
    assert.throws(
      () =>
        runStorageTransaction(database, () => {
          repositories.projects.insert({
            projectId: "project-rollback",
            rootPath: "/repo",
            grapeDirPath: "/repo/.grape",
            createdAt: now,
            updatedAt: now
          });
          throw new Error("stop transaction");
        }),
      /stop transaction/
    );

    assert.equal(
      database.prepare("SELECT count(*) AS count FROM projects WHERE project_id = 'project-rollback'").get().count,
      0
    );
  });
});
