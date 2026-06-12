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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-context-ledger-"));
  const database = new DatabaseSync(path.join(dir, "grape.db"));

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    fn(createStorageRepositories(database));
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function insertBaseGraph(repositories) {
  repositories.projects.insert({
    projectId: "project-1",
    rootPath: "/repo",
    grapeDirPath: "/repo/.grape",
    createdAt: now,
    updatedAt: now
  });
  repositories.repos.insert({
    repoId: "repo-1",
    projectId: "project-1",
    vcsType: "git",
    rootPath: "/repo",
    normalizedRootPath: "/repo",
    createdAt: now,
    updatedAt: now
  });
  repositories.repoSnapshots.insert({
    snapshotId: "snapshot-1",
    repoId: "repo-1",
    branch: "main",
    commitSha: "abc123",
    worktreeHash: hashA,
    snapshotHash: hashB,
    dirtyState: "clean",
    createdAt: now
  });
  repositories.worktreeStates.insert({
    worktreeStateId: "worktree-1",
    snapshotId: "snapshot-1",
    state: "clean",
    dirtyPathsJson: "[]",
    createdAt: now
  });
  repositories.contextSessions.insert({
    sessionId: "session-1",
    projectId: "project-1",
    repoId: "repo-1",
    repoSnapshotId: "snapshot-1",
    worktreeStateId: "worktree-1",
    agentName: "codex",
    agentSessionId: "agent-session-1",
    taskId: "task-1",
    taskType: "analysis",
    branchName: "main",
    headCommitSha: "abc123",
    status: "active",
    lockStatus: "locked",
    lockToken: "lock-1",
    startedAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now
  });
  repositories.contextArtifacts.insert({
    artifactId: "artifact-1",
    sessionId: "session-1",
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

function insertSentWithPack(repositories, overrides = {}) {
  const sentItemId = overrides.sentItemId ?? "sent-1";
  const sectionId = overrides.sectionId ?? "section-1";
  const itemKind = overrides.itemKind ?? "claim";
  const lastSentAt = overrides.lastSentAt ?? now;
  repositories.contextSentItems.insert({
    sentItemId,
    sessionId: "session-1",
    artifactId: "artifact-1",
    sectionId,
    taskId: "task-1",
    itemKind,
    itemRef: `${itemKind}:${sectionId}`,
    itemHash: hashA,
    contentHash: hashA,
    branchName: overrides.branchName ?? "main",
    commitSha: overrides.commitSha ?? "abc123",
    dependencyManifestHash: hashB,
    wasPinned: false,
    lastDiffState: overrides.lastDiffState ?? "NEW",
    firstSentAt: overrides.firstSentAt ?? lastSentAt,
    lastSentAt,
    sendCount: overrides.sendCount ?? 1,
    tokenCount: 42
  });
  repositories.contextPackItems.insert({
    packItemId: sentItemId,
    sessionId: "session-1",
    artifactId: "artifact-1",
    sectionId,
    diffState: overrides.diffState ?? "NEW",
    itemKind,
    itemRef: `${itemKind}:${sectionId}`,
    contentHash: hashA,
    tokenCount: 42,
    pinned: false,
    safetyCritical: false,
    inputRefsJson: "[\"dep-1\"]",
    createdAt: lastSentAt
  });
}

function insertInvalidation(repositories, sentItemId) {
  repositories.contextPackItems.insert({
    packItemId: `invalidate:${sentItemId}`,
    sessionId: "session-1",
    artifactId: "artifact-1",
    sectionId: "section-d",
    diffState: "INVALIDATE_PREVIOUS",
    itemKind: "invalidation",
    itemRef: sentItemId,
    contentHash: hashA,
    tokenCount: 1,
    pinned: false,
    safetyCritical: false,
    invalidatesSentItemId: sentItemId,
    inputRefsJson: "[\"dep-1\"]",
    createdAt: "2026-05-24T00:10:00.000Z"
  });
}

test("context ledger repositories expose only latest active sent rows for build paths", () => {
  withMigratedDatabase((repositories) => {
    insertBaseGraph(repositories);
    insertSentWithPack(repositories, {
      sentItemId: "sent-old-a",
      sectionId: "section-a",
      lastSentAt: "2026-05-24T00:00:00.000Z"
    });
    insertSentWithPack(repositories, {
      sentItemId: "sent-new-a",
      sectionId: "section-a",
      lastSentAt: "2026-05-24T00:02:00.000Z"
    });
    insertSentWithPack(repositories, {
      sentItemId: "sent-feature-b",
      sectionId: "section-b",
      branchName: "feature/context",
      commitSha: "def456",
      lastSentAt: "2026-05-24T00:03:00.000Z"
    });
    insertSentWithPack(repositories, {
      sentItemId: "sent-compression-c",
      sectionId: "section-c",
      itemKind: "compression_artifact",
      lastSentAt: "2026-05-24T00:04:00.000Z"
    });
    insertSentWithPack(repositories, {
      sentItemId: "sent-invalidated-d",
      sectionId: "section-d",
      lastSentAt: "2026-05-24T00:05:00.000Z"
    });
    insertInvalidation(repositories, "sent-invalidated-d");

    assert.deepEqual(
      repositories.contextSentItems.listActiveBySession("session-1").map((item) => item.sentItemId),
      ["sent-new-a", "sent-feature-b", "sent-compression-c"]
    );
    assert.deepEqual(
      repositories.contextSentItems
        .listActiveBySessionScope({
          sessionId: "session-1",
          branchName: "main",
          commitSha: "abc123",
          excludedKind: "compression_artifact"
        })
        .map((item) => item.sentItemId),
      ["sent-new-a"]
    );
    assert.deepEqual(
      repositories.contextPackItems
        .listActiveSentPayloadsBySession("session-1")
        .map((item) => item.packItemId),
      ["sent-new-a", "sent-feature-b", "sent-compression-c"]
    );
  });
});
