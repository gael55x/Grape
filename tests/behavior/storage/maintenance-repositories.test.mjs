import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  applyStorageMigrations,
  createCompressionStorageRepositories,
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createMaintenanceStorageRepositories,
  createStorageRepositories,
  storageMigrationReferences
} from "../../../.tmp/build/src/core/storage/index.js";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const now = "2026-06-20T00:00:00.000Z";
const oldTime = "2026-04-01T00:00:00.000Z";
const newTime = "2026-06-19T00:00:00.000Z";
const latestTime = "2026-06-20T01:00:00.000Z";

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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-maintenance-repositories-"));
  const database = new DatabaseSync(path.join(dir, "grape.db"));

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    fn(database, {
      storage: createStorageRepositories(database),
      evidence: createEvidenceStorageRepositories(database),
      indexing: createIndexingStorageRepositories(database),
      compression: createCompressionStorageRepositories(database),
      maintenance: createMaintenanceStorageRepositories(database)
    });
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test("maintenance repository plans compression cache compaction conservatively", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories.storage);
    insertSession(repositories.storage, "session-1");
    insertArtifact(repositories.storage, "artifact-live", "session-1", newTime);
    insertArtifact(repositories.storage, "artifact-delete", "session-1", oldTime);

    insertCompressionArtifact(repositories.compression, "compression-delete-age", oldTime, 2);
    insertCompressionArtifact(repositories.compression, "compression-protected-live", oldTime, 1);
    insertCompressionArtifact(repositories.compression, "compression-reference-deleting-artifact", oldTime, 1);
    insertCompressionArtifact(repositories.compression, "compression-retained-new", "2026-06-19T00:00:02.000Z", 2);
    insertCompressionArtifact(repositories.compression, "compression-delete-row-cap", "2026-06-19T00:00:01.000Z", 1);

    insertCompressionDependency(repositories.storage, "artifact-live", "compression-protected-live");
    insertCompressionDependency(
      repositories.storage,
      "artifact-delete",
      "compression-reference-deleting-artifact"
    );

    const plan = repositories.maintenance.retention.planCompressionCompaction({
      now,
      limit: { maxAgeDays: 30, maxRows: 2 },
      ignoredContextArtifactIds: ["artifact-delete"]
    });

    assert.equal(plan.totalArtifacts, 5);
    assert.equal(plan.totalInputRows, 7);
    assert.deepEqual(
      plan.candidateArtifacts.map((artifact) => artifact.compressionId).sort(),
      [
        "compression-delete-age",
        "compression-delete-row-cap",
        "compression-reference-deleting-artifact"
      ]
    );
    assert.deepEqual(
      plan.protectedArtifacts.map((artifact) => artifact.compressionId),
      ["compression-protected-live"]
    );
    assert.equal(plan.protectedArtifacts[0].protection, "referenced_by_context_artifact");
    assert.equal(plan.rowCounts.compressionArtifacts, 3);
    assert.equal(plan.rowCounts.compressionInputs, 4);

    assert.equal(
      repositories.maintenance.retention.deleteCompressionArtifacts(["compression-delete-age"]),
      1
    );
    assert.equal(countRows(database, "compression_artifacts", "compression_id", "compression-delete-age"), 0);
    assert.equal(countRows(database, "compression_inputs", "compression_id", "compression-delete-age"), 0);
  });
});

test("maintenance repository plans FTS compaction by whole snapshot", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories.storage);
    insertSnapshot(repositories.storage, "snapshot-old-a", oldTime);
    insertSnapshot(repositories.storage, "snapshot-old-b", "2026-04-02T00:00:00.000Z");
    insertSnapshot(repositories.storage, "snapshot-new", latestTime);

    insertFtsRows(repositories, "snapshot-old-a", oldTime, 2);
    insertFtsRows(repositories, "snapshot-old-b", "2026-04-02T00:00:00.000Z", 1);
    insertFtsRows(repositories, "snapshot-new", latestTime, 2);

    const plan = repositories.maintenance.retention.planFtsCompaction({
      now,
      limit: { maxAgeDays: 30, maxRows: 1 }
    });

    assert.equal(plan.totalSnapshots, 3);
    assert.equal(plan.totalRows, 5);
    assert.equal(plan.retentionMatchedRows, 5);
    assert.deepEqual(
      plan.candidateSnapshots.map((snapshot) => snapshot.snapshotId).sort(),
      ["snapshot-old-a", "snapshot-old-b"]
    );
    assert.equal(plan.rowCounts.ftsEntries, 3);
    assert.equal(plan.rowCounts.ftsEntryText, 3);
    assert.equal(plan.protectedSnapshots.length, 1);
    assert.equal(plan.protectedSnapshots[0].snapshotId, "snapshot-new");
    assert.equal(plan.protectedSnapshots[0].protection, "latest_repo_snapshot");
    assert.equal(plan.protectedSnapshots[0].reason, "row_limit");

    assert.equal(
      repositories.maintenance.retention.deleteFtsSnapshots(["snapshot-old-a"]),
      2
    );
    assert.equal(countRows(database, "fts_entries", "snapshot_id", "snapshot-old-a"), 0);
    assert.equal(countRowsByJoin(database, "snapshot-old-a"), 0);
    assert.equal(countRows(database, "sources", "snapshot_id", "snapshot-old-a"), 2);
    assert.equal(countRows(database, "repo_snapshots", "snapshot_id", "snapshot-old-a"), 1);
    assert.equal(countRows(database, "fts_entries", "snapshot_id", "snapshot-new"), 2);
  });
});

test("maintenance repository plans derived metadata compaction by whole snapshot", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories.storage);
    insertSnapshot(repositories.storage, "snapshot-old-a", oldTime);
    insertSnapshot(repositories.storage, "snapshot-old-b", "2026-04-02T00:00:00.000Z");
    insertSnapshot(repositories.storage, "snapshot-new", latestTime);

    insertSymbolMetadata(repositories, "snapshot-old-a", oldTime, 2, 1);
    insertSymbolMetadata(repositories, "snapshot-old-b", "2026-04-02T00:00:00.000Z", 1, 0);
    insertSymbolMetadata(repositories, "snapshot-new", latestTime, 1, 1);

    const plan = repositories.maintenance.retention.planDerivedMetadataCompaction({
      now,
      limit: { maxAgeDays: 30, maxRows: 1 }
    });

    assert.equal(plan.totalSnapshots, 3);
    assert.equal(plan.totalRows, 6);
    assert.equal(plan.totalNodeRows, 4);
    assert.equal(plan.totalEdgeRows, 2);
    assert.equal(plan.retentionMatchedRows, 6);
    assert.deepEqual(
      plan.candidateSnapshots.map((snapshot) => snapshot.snapshotId).sort(),
      ["snapshot-old-a", "snapshot-old-b"]
    );
    assert.equal(plan.rowCounts.symbolNodes, 3);
    assert.equal(plan.rowCounts.symbolEdges, 1);
    assert.equal(plan.protectedSnapshots.length, 1);
    assert.equal(plan.protectedSnapshots[0].snapshotId, "snapshot-new");
    assert.equal(plan.protectedSnapshots[0].protection, "latest_repo_snapshot");
    assert.equal(plan.protectedSnapshots[0].reason, "row_limit");

    const deletion = repositories.maintenance.retention.deleteDerivedMetadataSnapshots(["snapshot-old-a"]);

    assert.deepEqual(deletion, { symbolNodes: 2, symbolEdges: 1 });
    assert.equal(countRows(database, "symbol_nodes", "snapshot_id", "snapshot-old-a"), 0);
    assert.equal(countRows(database, "symbol_edges", "snapshot_id", "snapshot-old-a"), 0);
    assert.equal(countRows(database, "sources", "snapshot_id", "snapshot-old-a"), 2);
    assert.equal(countRows(database, "repo_snapshots", "snapshot_id", "snapshot-old-a"), 1);
    assert.equal(countRows(database, "symbol_nodes", "snapshot_id", "snapshot-new"), 1);
    assert.equal(countRows(database, "symbol_edges", "snapshot_id", "snapshot-new"), 1);
  });
});

test("maintenance repository preserves derived metadata referenced by surviving artifacts", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories.storage);
    insertSnapshot(repositories.storage, "snapshot-old", oldTime);
    insertSnapshot(repositories.storage, "snapshot-new", latestTime);
    insertSession(repositories.storage, "session-symbol");
    insertArtifact(repositories.storage, "artifact-symbol-live", "session-symbol", newTime);

    insertSymbolMetadata(repositories, "snapshot-old", oldTime, 1, 0);
    insertSymbolMetadata(repositories, "snapshot-new", latestTime, 1, 0);
    insertSymbolDependency(
      repositories.storage,
      "artifact-symbol-live",
      "symbol:snapshot-old:0"
    );

    const protectedPlan = repositories.maintenance.retention.planDerivedMetadataCompaction({
      now,
      limit: { maxAgeDays: 30, maxRows: 0 }
    });

    assert.deepEqual(protectedPlan.candidateSnapshots.map((snapshot) => snapshot.snapshotId), []);
    assert.equal(protectedPlan.protectedSnapshots.length, 2);
    assert.equal(
      protectedPlan.protectedSnapshots.find((snapshot) => snapshot.snapshotId === "snapshot-old")?.protection,
      "referenced_by_context_artifact"
    );
    assert.equal(
      protectedPlan.protectedSnapshots.find((snapshot) => snapshot.snapshotId === "snapshot-new")?.protection,
      "latest_repo_snapshot"
    );

    const ignoredPlan = repositories.maintenance.retention.planDerivedMetadataCompaction({
      now,
      limit: { maxAgeDays: 30, maxRows: 0 },
      ignoredContextArtifactIds: ["artifact-symbol-live"]
    });

    assert.deepEqual(ignoredPlan.candidateSnapshots.map((snapshot) => snapshot.snapshotId), ["snapshot-old"]);
    assert.equal(ignoredPlan.rowCounts.symbolNodes, 1);
    assert.equal(ignoredPlan.rowCounts.symbolEdges, 0);
    assert.equal(countRows(database, "context_dependencies", "artifact_id", "artifact-symbol-live"), 1);
  });
});

test("maintenance repository plans snapshot compaction only for orphan snapshots", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories.storage);
    insertSnapshot(repositories.storage, "snapshot-orphan-old", oldTime);
    insertSnapshot(repositories.storage, "snapshot-session-old", oldTime);
    insertSnapshot(repositories.storage, "snapshot-artifact-old", oldTime);
    insertSnapshot(repositories.storage, "snapshot-compression-old", oldTime);
    insertSnapshot(repositories.storage, "snapshot-fts-old", oldTime);
    insertSnapshot(repositories.storage, "snapshot-symbol-node-old", oldTime);
    insertSnapshot(repositories.storage, "snapshot-symbol-edge-old", oldTime);
    insertSnapshot(repositories.storage, "snapshot-source-old", oldTime);
    insertSnapshot(repositories.storage, "snapshot-dependency-old", oldTime);

    insertSessionForSnapshot(repositories.storage, "session-snapshot-old", "snapshot-session-old");
    insertSession(repositories.storage, "session-base");
    insertArtifactForSnapshot(
      repositories.storage,
      "artifact-snapshot-old",
      "session-base",
      "snapshot-artifact-old",
      oldTime
    );
    insertCompressionArtifactForSnapshot(
      repositories.compression,
      "compression-snapshot-old",
      "snapshot-compression-old",
      "snapshot-compression-old:worktree",
      oldTime,
      1
    );
    insertFtsRows(repositories, "snapshot-fts-old", oldTime, 1);
    insertSymbolMetadata(repositories, "snapshot-symbol-node-old", oldTime, 1, 0);
    insertSymbolEdgeOnly(repositories, "snapshot-symbol-edge-old", oldTime);
    insertSourceOnly(repositories.evidence, "snapshot-source-old", oldTime);
    insertSnapshotDependency(repositories.storage, "snapshot-dependency-old");

    const plan = repositories.maintenance.retention.planSnapshotCompaction({
      now,
      limit: { maxAgeDays: 30, maxRows: 0 }
    });

    assert.equal(plan.totalSnapshots, 10);
    assert.equal(plan.retentionMatchedSnapshots, 10);
    assert.deepEqual(
      plan.candidateSnapshots.map((snapshot) => snapshot.snapshotId),
      ["snapshot-orphan-old"]
    );
    assert.equal(plan.rowCounts.repoSnapshots, 1);
    assert.equal(plan.rowCounts.worktreeStates, 1);
    assert.equal(
      plan.protectedSnapshots.find((snapshot) => snapshot.snapshotId === "snapshot-1")?.protection,
      "latest_repo_snapshot"
    );
    assert.equal(
      plan.protectedSnapshots.find((snapshot) => snapshot.snapshotId === "snapshot-session-old")?.protection,
      "context_session"
    );
    assert.equal(
      plan.protectedSnapshots.find((snapshot) => snapshot.snapshotId === "snapshot-artifact-old")?.protection,
      "context_artifact"
    );
    assert.equal(
      plan.protectedSnapshots.find((snapshot) => snapshot.snapshotId === "snapshot-compression-old")?.protection,
      "compression_artifact"
    );
    assert.equal(
      plan.protectedSnapshots.find((snapshot) => snapshot.snapshotId === "snapshot-fts-old")?.protection,
      "fts_entry"
    );
    assert.equal(
      plan.protectedSnapshots.find((snapshot) => snapshot.snapshotId === "snapshot-symbol-node-old")?.protection,
      "symbol_node"
    );
    assert.equal(
      plan.protectedSnapshots.find((snapshot) => snapshot.snapshotId === "snapshot-symbol-edge-old")?.protection,
      "symbol_edge"
    );
    assert.equal(
      plan.protectedSnapshots.find((snapshot) => snapshot.snapshotId === "snapshot-source-old")?.protection,
      "source"
    );
    assert.equal(
      plan.protectedSnapshots.find((snapshot) => snapshot.snapshotId === "snapshot-dependency-old")?.protection,
      "context_dependency"
    );
  });
});

test("maintenance repository deletes only orphan snapshot and worktree rows", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories.storage);
    insertSnapshot(repositories.storage, "snapshot-orphan-delete", oldTime);

    const plan = repositories.maintenance.retention.planSnapshotCompaction({
      now,
      limit: { maxAgeDays: 30, maxRows: 1 }
    });

    assert.deepEqual(
      plan.candidateSnapshots.map((snapshot) => snapshot.snapshotId),
      ["snapshot-orphan-delete"]
    );
    assert.equal(repositories.maintenance.retention.deleteRepoSnapshots(["snapshot-orphan-delete"]), 1);
    assert.equal(countRows(database, "repo_snapshots", "snapshot_id", "snapshot-orphan-delete"), 0);
    assert.equal(countRows(database, "worktree_states", "snapshot_id", "snapshot-orphan-delete"), 0);
    assert.equal(countRows(database, "repo_snapshots", "snapshot_id", "snapshot-1"), 1);
    assert.equal(countRows(database, "worktree_states", "snapshot_id", "snapshot-1"), 1);
  });
});

test("maintenance repository plans invalidated record compaction as closed pairs", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories.storage);
    insertSession(repositories.storage, "session-invalidated");
    insertArtifact(repositories.storage, "artifact-sent-delete", "session-invalidated", oldTime);
    insertArtifact(repositories.storage, "artifact-invalidation-delete", "session-invalidated", oldTime);
    insertInvalidatedSentPair(repositories.storage, {
      sessionId: "session-invalidated",
      sentArtifactId: "artifact-sent-delete",
      invalidationArtifactId: "artifact-invalidation-delete",
      sentItemId: "sent-delete",
      invalidationPackItemId: "invalidate-delete",
      sentAt: oldTime,
      invalidatedAt: oldTime
    });

    insertArtifact(repositories.storage, "artifact-sent-retained", "session-invalidated", oldTime);
    insertArtifact(repositories.storage, "artifact-invalidation-retained-old", "session-invalidated", oldTime);
    insertArtifact(repositories.storage, "artifact-invalidation-retained-new", "session-invalidated", newTime);
    insertInvalidatedSentPair(repositories.storage, {
      sessionId: "session-invalidated",
      sentArtifactId: "artifact-sent-retained",
      invalidationArtifactId: "artifact-invalidation-retained-old",
      sentItemId: "sent-retained",
      invalidationPackItemId: "invalidate-retained-old",
      sentAt: oldTime,
      invalidatedAt: oldTime
    });
    insertInvalidationOnly(repositories.storage, {
      sessionId: "session-invalidated",
      artifactId: "artifact-invalidation-retained-new",
      invalidationPackItemId: "invalidate-retained-new",
      sentItemId: "sent-retained",
      invalidatedAt: newTime
    });

    insertSession(repositories.storage, "session-invalidated-locked", "locked");
    insertArtifact(repositories.storage, "artifact-sent-locked", "session-invalidated-locked", oldTime);
    insertArtifact(repositories.storage, "artifact-invalidation-locked", "session-invalidated-locked", oldTime);
    insertInvalidatedSentPair(repositories.storage, {
      sessionId: "session-invalidated-locked",
      sentArtifactId: "artifact-sent-locked",
      invalidationArtifactId: "artifact-invalidation-locked",
      sentItemId: "sent-locked",
      invalidationPackItemId: "invalidate-locked",
      sentAt: oldTime,
      invalidatedAt: oldTime
    });

    const plan = repositories.maintenance.retention.planInvalidatedRecordCompaction({
      now,
      limit: { maxAgeDays: 30, maxRows: 100 }
    });

    assert.deepEqual(
      plan.candidateInvalidations.map((record) => record.invalidationPackItemId),
      ["invalidate-delete"]
    );
    assert.equal(plan.rowCounts.invalidationPackItems, 1);
    assert.equal(plan.rowCounts.invalidatedSentItems, 1);
    assert.equal(plan.rowCounts.invalidatedSentPackItems, 1);
    assert.equal(
      plan.protectedInvalidations.find((record) => record.invalidationPackItemId === "invalidate-retained-old")?.protection,
      "sent_row_retained"
    );
    assert.equal(
      plan.protectedInvalidations.find((record) => record.invalidationPackItemId === "invalidate-locked")?.protection,
      "locked_session"
    );
  });
});

test("maintenance repository deletes invalidated records without reviving stale sent context", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories.storage);
    insertSession(repositories.storage, "session-delete-invalidated");
    insertArtifact(repositories.storage, "artifact-sent-delete", "session-delete-invalidated", oldTime);
    insertArtifact(repositories.storage, "artifact-invalidation-delete", "session-delete-invalidated", oldTime);
    insertInvalidatedSentPair(repositories.storage, {
      sessionId: "session-delete-invalidated",
      sentArtifactId: "artifact-sent-delete",
      invalidationArtifactId: "artifact-invalidation-delete",
      sentItemId: "sent-delete-invalidated",
      invalidationPackItemId: "invalidate-delete-invalidated",
      sentAt: oldTime,
      invalidatedAt: oldTime
    });

    assert.equal(repositories.storage.contextSentItems.listActiveBySession("session-delete-invalidated").length, 0);
    const deletion = repositories.maintenance.retention.deleteInvalidatedRecords([
      "invalidate-delete-invalidated"
    ]);

    assert.deepEqual(deletion, {
      invalidationPackItems: 1,
      invalidatedSentItems: 1,
      invalidatedSentPackItems: 1
    });
    assert.equal(countRows(database, "context_pack_items", "pack_item_id", "invalidate-delete-invalidated"), 0);
    assert.equal(countRows(database, "context_pack_items", "pack_item_id", "sent-delete-invalidated"), 0);
    assert.equal(countRows(database, "context_sent_items", "sent_item_id", "sent-delete-invalidated"), 0);
    assert.equal(repositories.storage.contextSentItems.listActiveBySession("session-delete-invalidated").length, 0);
  });
});

test("maintenance repository refuses marker-only invalidated record deletion", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories.storage);
    insertSession(repositories.storage, "session-retain-invalidated");
    insertArtifact(repositories.storage, "artifact-sent-retained", "session-retain-invalidated", oldTime);
    insertArtifact(repositories.storage, "artifact-invalidation-old", "session-retain-invalidated", oldTime);
    insertArtifact(repositories.storage, "artifact-invalidation-new", "session-retain-invalidated", newTime);
    insertInvalidatedSentPair(repositories.storage, {
      sessionId: "session-retain-invalidated",
      sentArtifactId: "artifact-sent-retained",
      invalidationArtifactId: "artifact-invalidation-old",
      sentItemId: "sent-retained-invalidated",
      invalidationPackItemId: "invalidate-retained-invalidated-old",
      sentAt: oldTime,
      invalidatedAt: oldTime
    });
    insertInvalidationOnly(repositories.storage, {
      sessionId: "session-retain-invalidated",
      artifactId: "artifact-invalidation-new",
      invalidationPackItemId: "invalidate-retained-invalidated-new",
      sentItemId: "sent-retained-invalidated",
      invalidatedAt: newTime
    });

    const deletion = repositories.maintenance.retention.deleteInvalidatedRecords([
      "invalidate-retained-invalidated-old"
    ]);

    assert.deepEqual(deletion, {
      invalidationPackItems: 0,
      invalidatedSentItems: 0,
      invalidatedSentPackItems: 0
    });
    assert.equal(countRows(database, "context_pack_items", "pack_item_id", "invalidate-retained-invalidated-old"), 1);
    assert.equal(countRows(database, "context_sent_items", "sent_item_id", "sent-retained-invalidated"), 1);
    assert.equal(repositories.storage.contextSentItems.listActiveBySession("session-retain-invalidated").length, 0);
  });
});

test("maintenance repository protects artifacts with needed invalidation markers", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories.storage);
    insertSession(repositories.storage, "session-marker-artifact");
    insertArtifact(repositories.storage, "artifact-sent-marker", "session-marker-artifact", oldTime);
    insertArtifact(repositories.storage, "artifact-invalidation-marker", "session-marker-artifact", oldTime);
    insertArtifact(repositories.storage, "artifact-new-marker", "session-marker-artifact", newTime);
    insertInvalidatedSentPair(repositories.storage, {
      sessionId: "session-marker-artifact",
      sentArtifactId: "artifact-sent-marker",
      invalidationArtifactId: "artifact-invalidation-marker",
      sentItemId: "sent-marker-artifact",
      invalidationPackItemId: "invalidate-marker-artifact",
      sentAt: oldTime,
      invalidatedAt: oldTime
    });

    const plan = repositories.maintenance.retention.planContextArtifactCompaction({
      now,
      limit: { maxAgeDays: 30, maxRows: 0 }
    });

    assert.equal(
      plan.protectedArtifacts.find((artifact) => artifact.artifactId === "artifact-invalidation-marker")?.protection,
      "invalidation_marker"
    );
  });
});

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
}

function insertSnapshot(repositories, snapshotId, createdAt) {
  repositories.repoSnapshots.insert({
    snapshotId,
    repoId: "repo-1",
    branch: "main",
    commitSha: `commit:${snapshotId}`,
    worktreeHash: hashA,
    snapshotHash: hashB,
    dirtyState: "clean",
    createdAt
  });
  repositories.worktreeStates.insert({
    worktreeStateId: `${snapshotId}:worktree`,
    snapshotId,
    state: "clean",
    dirtyPathsJson: "[]",
    createdAt
  });
}

function insertSession(repositories, sessionId, lockStatus = "unlocked") {
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
    lockStatus,
    lockToken: lockStatus === "locked" ? `lock:${sessionId}` : undefined,
    startedAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now
  });
}

function insertSessionForSnapshot(repositories, sessionId, snapshotId) {
  repositories.contextSessions.insert({
    sessionId,
    projectId: "project-1",
    repoId: "repo-1",
    repoSnapshotId: snapshotId,
    worktreeStateId: `${snapshotId}:worktree`,
    agentName: "codex",
    agentSessionId: sessionId,
    taskId: "task-1",
    taskType: "analysis",
    branchName: "main",
    headCommitSha: "abc123",
    status: "active",
    lockStatus: "unlocked",
    startedAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now
  });
}

function insertFtsRows(repositories, snapshotId, createdAt, count) {
  for (let index = 0; index < count; index += 1) {
    const sourceId = `source:${snapshotId}:${index}`;
    repositories.evidence.sources.insertOrIgnore({
      sourceId,
      snapshotId,
      sourceType: "repository_file",
      sourceRef: `src/${snapshotId}-${index}.ts`,
      sourceHash: `hash:source:${snapshotId}:${index}`,
      sourceScope: "committed",
      trustClass: "trusted",
      privacyStatus: "allowed",
      redactionStatus: "not_needed",
      metadataJson: "{}",
      createdAt
    });
    repositories.indexing.ftsEntries.insertOrIgnore({
      ftsEntryId: `fts:${snapshotId}:${index}`,
      projectId: "project-1",
      repoId: "repo-1",
      snapshotId,
      sourceId,
      sourceRef: `src/${snapshotId}-${index}.ts`,
      sourceType: "repository_file",
      sourceHash: `hash:source:${snapshotId}:${index}`,
      textHash: `hash:text:${snapshotId}:${index}`,
      metadataJson: "{}",
      createdAt,
      body: `searchable text ${snapshotId} ${index}`
    });
  }
}

function insertSymbolMetadata(repositories, snapshotId, createdAt, nodeCount, edgeCount) {
  for (let index = 0; index < nodeCount; index += 1) {
    const sourceId = `source:symbol:${snapshotId}:${index}`;
    const symbolId = `symbol:${snapshotId}:${index}`;
    repositories.evidence.sources.insertOrIgnore({
      sourceId,
      snapshotId,
      sourceType: "repository_file",
      sourceRef: `src/${snapshotId}-symbol-${index}.ts`,
      sourceHash: `hash:symbol-source:${snapshotId}:${index}`,
      sourceScope: "committed",
      trustClass: "trusted",
      privacyStatus: "allowed",
      redactionStatus: "not_needed",
      metadataJson: "{}",
      createdAt
    });
    repositories.indexing.symbolNodes.insertOrIgnore({
      symbolId,
      projectId: "project-1",
      repoId: "repo-1",
      snapshotId,
      sourceId,
      path: `src/${snapshotId}-symbol-${index}.ts`,
      language: "typescript",
      name: `symbol${index}`,
      symbolKind: index === 0 ? "module" : "function",
      startLine: 1,
      endLine: 1,
      bodyHash: `hash:symbol-body:${snapshotId}:${index}`,
      signatureHash: `hash:symbol-signature:${snapshotId}:${index}`,
      confidence: "high",
      metadataJson: "{}",
      createdAt
    });
  }

  for (let index = 0; index < edgeCount; index += 1) {
    repositories.indexing.symbolEdges.insertOrIgnore({
      edgeId: `symbol_edge:${snapshotId}:${index}`,
      projectId: "project-1",
      repoId: "repo-1",
      snapshotId,
      fromSymbolId: `symbol:${snapshotId}:0`,
      toSymbolId: nodeCount > 1 ? `symbol:${snapshotId}:1` : undefined,
      toRef: nodeCount > 1 ? undefined : `./${snapshotId}`,
      edgeType: "imports",
      confidence: "high",
      discoveryMethod: "ast",
      metadataJson: "{}",
      createdAt
    });
  }
}

function insertArtifact(repositories, artifactId, sessionId, createdAt) {
  insertArtifactForSnapshot(repositories, artifactId, sessionId, "snapshot-1", createdAt);
}

function insertArtifactForSnapshot(repositories, artifactId, sessionId, snapshotId, createdAt) {
  repositories.contextArtifacts.insert({
    artifactId,
    sessionId,
    snapshotId,
    artifactHash: `hash:${artifactId}`,
    dependencyManifestHash: hashB,
    taskType: "analysis",
    riskOverlaysJson: "[]",
    warningsJson: "[]",
    unsafeReasonsJson: "[]",
    createdAt
  });
}

function insertCompressionArtifact(repositories, compressionId, createdAt, inputCount) {
  insertCompressionArtifactForSnapshot(
    repositories,
    compressionId,
    "snapshot-1",
    "worktree-1",
    createdAt,
    inputCount
  );
}

function insertCompressionArtifactForSnapshot(
  repositories,
  compressionId,
  snapshotId,
  worktreeStateId,
  createdAt,
  inputCount
) {
  repositories.compressionArtifacts.upsert({
    compressionId,
    projectId: "project-1",
    repoId: "repo-1",
    repoSnapshotId: snapshotId,
    worktreeStateId,
    artifactType: "symbol_outline",
    method: "deterministic",
    summaryText: `summary:${compressionId}`,
    inputHash: `hash:input:${compressionId}`,
    policyHash: hashA,
    scopeHash: hashA,
    outputHash: `hash:output:${compressionId}`,
    trustStatus: "derived_cache",
    createdAt,
    updatedAt: createdAt
  });

  for (let index = 0; index < inputCount; index += 1) {
    repositories.compressionInputs.upsert({
      compressionInputId: `compression-input:${compressionId}:${index}`,
      compressionId,
      inputKind: "file",
      inputRef: `src/input-${index}.ts`,
      inputHash: `hash:input:${compressionId}:${index}`
    });
  }
}

function insertSourceOnly(repositories, snapshotId, createdAt) {
  repositories.sources.insertOrIgnore({
    sourceId: `source:only:${snapshotId}`,
    snapshotId,
    sourceType: "repository_file",
    sourceRef: `src/${snapshotId}-source.ts`,
    sourceHash: `hash:source-only:${snapshotId}`,
    sourceScope: "committed",
    trustClass: "trusted",
    privacyStatus: "allowed",
    redactionStatus: "not_needed",
    metadataJson: "{}",
    createdAt
  });
}

function insertSymbolEdgeOnly(repositories, snapshotId, createdAt) {
  insertSymbolMetadata(repositories, "snapshot-1", now, 1, 0);
  repositories.indexing.symbolEdges.insertOrIgnore({
    edgeId: `symbol_edge:${snapshotId}:only`,
    projectId: "project-1",
    repoId: "repo-1",
    snapshotId,
    fromSymbolId: "symbol:snapshot-1:0",
    toRef: "./edge-only",
    edgeType: "imports",
    confidence: "high",
    discoveryMethod: "ast",
    metadataJson: "{}",
    createdAt
  });
}

function insertSnapshotDependency(repositories, snapshotId) {
  insertSession(repositories, "session-dependency-base");
  insertArtifact(repositories, "artifact-dependency-base", "session-dependency-base", newTime);
  repositories.contextDependencies.insert({
    dependencyId: `dependency:${snapshotId}`,
    artifactId: "artifact-dependency-base",
    dependencyKind: "repo_snapshot",
    dependencyRef: snapshotId,
    dependencyHash: `hash:${snapshotId}`,
    scopeJson: "{}",
    createdAt: now
  });
}

function insertInvalidatedSentPair(repositories, input) {
  repositories.contextSentItems.insert({
    sentItemId: input.sentItemId,
    sessionId: input.sessionId,
    artifactId: input.sentArtifactId,
    sectionId: `section:${input.sentItemId}`,
    taskId: "task-1",
    itemKind: "code_span",
    itemRef: "README.md",
    itemHash: `hash:item:${input.sentItemId}`,
    contentHash: `hash:content:${input.sentItemId}`,
    branchName: "main",
    commitSha: "abc123",
    dependencyManifestHash: hashB,
    wasPinned: false,
    lastDiffState: "NEW",
    firstSentAt: input.sentAt,
    lastSentAt: input.sentAt,
    sendCount: 1,
    tokenCount: 1
  });
  repositories.contextPackItems.insert({
    packItemId: input.sentItemId,
    sessionId: input.sessionId,
    artifactId: input.sentArtifactId,
    sectionId: `section:${input.sentItemId}`,
    diffState: "NEW",
    itemKind: "code_span",
    itemRef: "README.md",
    contentHash: `hash:content:${input.sentItemId}`,
    tokenCount: 1,
    pinned: false,
    safetyCritical: false,
    inputRefsJson: "[]",
    createdAt: input.sentAt
  });
  insertInvalidationOnly(repositories, {
    sessionId: input.sessionId,
    artifactId: input.invalidationArtifactId,
    invalidationPackItemId: input.invalidationPackItemId,
    sentItemId: input.sentItemId,
    invalidatedAt: input.invalidatedAt
  });
}

function insertInvalidationOnly(repositories, input) {
  repositories.contextPackItems.insert({
    packItemId: input.invalidationPackItemId,
    sessionId: input.sessionId,
    artifactId: input.artifactId,
    sectionId: `section:${input.sentItemId}`,
    diffState: "INVALIDATE_PREVIOUS",
    itemKind: "invalidation",
    itemRef: input.sentItemId,
    contentHash: `hash:invalidate:${input.invalidationPackItemId}`,
    tokenCount: 1,
    pinned: false,
    safetyCritical: true,
    invalidatesSentItemId: input.sentItemId,
    inputRefsJson: "[]",
    createdAt: input.invalidatedAt
  });
}

function insertCompressionDependency(repositories, artifactId, compressionId) {
  repositories.contextDependencies.insert({
    dependencyId: `dependency:${artifactId}:${compressionId}`,
    artifactId,
    dependencyKind: "compression_artifact",
    dependencyRef: compressionId,
    dependencyHash: `hash:output:${compressionId}`,
    scopeJson: "{}",
    createdAt: now
  });
}

function insertSymbolDependency(repositories, artifactId, symbolId) {
  repositories.contextDependencies.insert({
    dependencyId: `dependency:${artifactId}:${symbolId}`,
    artifactId,
    dependencyKind: "symbol",
    dependencyRef: symbolId,
    dependencyHash: `hash:${symbolId}`,
    scopeJson: "{}",
    createdAt: now
  });
}

function countRows(database, tableName, columnName, value) {
  const row = database
    .prepare(`SELECT count(*) AS count FROM ${tableName} WHERE ${columnName} = ?`)
    .get(value);
  return Number(row.count);
}

function countRowsByJoin(database, snapshotId) {
  const row = database
    .prepare(
      [
        "SELECT count(*) AS count",
        "FROM fts_entry_text text",
        "JOIN fts_entries entry ON entry.fts_entry_id = text.fts_entry_id",
        "WHERE entry.snapshot_id = ?"
      ].join(" ")
    )
    .get(snapshotId);
  return Number(row.count);
}
