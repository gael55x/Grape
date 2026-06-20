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
  repositories.contextArtifacts.insert({
    artifactId,
    sessionId,
    snapshotId: "snapshot-1",
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
  repositories.compressionArtifacts.upsert({
    compressionId,
    projectId: "project-1",
    repoId: "repo-1",
    repoSnapshotId: "snapshot-1",
    worktreeStateId: "worktree-1",
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
