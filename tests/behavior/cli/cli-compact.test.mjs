import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  createCompressionStorageRepositories,
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createStorageRepositories
} from "../../../.tmp/build/src/core/storage/index.js";
import { artifactFileBaseName } from "../../../.tmp/build/src/app/local-project/context/artifact-files.js";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");
const oldTime = "2026-04-01T00:00:00.000Z";
const newTime = "2026-06-19T00:00:00.000Z";

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-cli-compact-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    writeFileSync(path.join(dir, "README.md"), "# Fixture\n");
    execGit(dir, ["add", "README.md"]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "initial fixture"
    ]);
    const canonicalRepoPath = execGit(dir, ["rev-parse", "--show-toplevel"]);
    fn(canonicalRepoPath);
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

function runCli(repoPath, args, cwd = repoPath) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8"
  });
}

function runCliJson(repoPath, args) {
  const result = runCli(repoPath, [...args, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("compact help documents preview, confirm, and cleanup scope", () => {
  const help = runCli(process.cwd(), ["compact", "--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /grape compact --confirm/);
  assert.match(help.stdout, /Without --confirm, no data is deleted/);
  assert.match(help.stdout, /context artifacts, compression cache rows, FTS rows, derived symbol metadata, and orphan snapshots/);
  assert.match(help.stdout, /orphan snapshots/);
  assert.match(help.stdout, /FTS rows only by whole snapshot/);
  assert.match(help.stdout, /derived symbol metadata only by whole snapshot/);
  assert.match(help.stdout, /preserves compression cache rows still referenced/);
  assert.match(help.stdout, /deletes repo snapshots only when they are orphaned/);
  assert.match(help.stdout, /does not delete claims, proofs, sources/);

  const conflict = runCli(process.cwd(), ["compact", "--dry-run", "--confirm"]);
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /Choose either --dry-run or --confirm/);
});

test("compact previews and applies eligible context artifact retention", () => {
  withGitRepo((repoPath) => {
    runCliJson(repoPath, ["init", "--connect"]);
    const seeded = seedRetentionArtifacts(repoPath);
    const preview = runCliJson(repoPath, ["compact"]);

    assert.equal(preview.dryRun, true);
    assert.equal(preview.applied, false);
    assert.equal(preview.confirmationRequired, true);
    assert.equal(preview.contextArtifacts.candidateArtifacts, 1);
    assert.equal(preview.contextArtifacts.deletedArtifacts, 0);
    assert.equal(preview.contextArtifacts.artifactFiles.plannedFiles, 3);
    assert.equal(preview.contextArtifacts.artifactFiles.deletedFiles, 0);
    assert.equal(preview.contextArtifacts.protectedByReason.latest_per_session, 1);
    assert.equal(preview.contextArtifacts.protectedByReason.active_sent_context, 1);
    assert.equal(preview.contextArtifacts.protectedByReason.restorable_omitted_context, 1);
    assert.equal(preview.contextArtifacts.protectedByReason.locked_session, 1);
    assert.equal(preview.compressionCache.candidateArtifacts, 1);
    assert.equal(preview.compressionCache.deletedArtifacts, 0);
    assert.equal(preview.compressionCache.protectedArtifacts, 1);
    assert.equal(preview.compressionCache.protectedByReason.referenced_by_context_artifact, 1);
    assert.equal(preview.compressionCache.rowCounts.compressionArtifacts, 1);
    assert.equal(preview.compressionCache.rowCounts.compressionInputs, 2);
    assert.equal(preview.ftsIndex.candidateSnapshots, 1);
    assert.equal(preview.ftsIndex.candidateRows, 2);
    assert.equal(preview.ftsIndex.retentionMatchedRows, 2);
    assert.equal(preview.ftsIndex.deletedRows, 0);
    assert.equal(preview.ftsIndex.rowCounts.ftsEntries, 2);
    assert.equal(preview.ftsIndex.rowCounts.ftsEntryText, 2);
    assert.equal(preview.derivedMetadata.candidateSnapshots, 1);
    assert.equal(preview.derivedMetadata.candidateRows, 3);
    assert.equal(preview.derivedMetadata.candidateNodeRows, 2);
    assert.equal(preview.derivedMetadata.candidateEdgeRows, 1);
    assert.equal(preview.derivedMetadata.deletedRows, 0);
    assert.equal(preview.derivedMetadata.rowCounts.symbolNodes, 2);
    assert.equal(preview.derivedMetadata.rowCounts.symbolEdges, 1);
    assert.equal(countArtifact(repoPath, seeded.deleteArtifactId), 1);
    assert.equal(everyArtifactFileExists(repoPath, seeded.deleteArtifactId), true);
    assert.equal(countCompressionArtifact(repoPath, seeded.deleteCompressionId), 1);
    assert.equal(countCompressionInputs(repoPath, seeded.deleteCompressionId), 2);
    assert.equal(countFtsEntries(repoPath, seeded.deleteFtsSnapshotId), 2);
    assert.equal(countFtsTextRows(repoPath, seeded.deleteFtsSnapshotId), 2);
    assert.equal(countSymbolNodes(repoPath, seeded.deleteDerivedSnapshotId), 2);
    assert.equal(countSymbolEdges(repoPath, seeded.deleteDerivedSnapshotId), 1);

    const apply = runCliJson(repoPath, ["compact", "--confirm"]);

    assert.equal(apply.dryRun, false);
    assert.equal(apply.applied, true);
    assert.equal(apply.confirmationRequired, false);
    assert.equal(apply.contextArtifacts.candidateArtifacts, 1);
    assert.equal(apply.contextArtifacts.deletedArtifacts, 1);
    assert.equal(apply.contextArtifacts.artifactFiles.deletedFiles, 3);
    assert.equal(apply.compressionCache.deletedArtifacts, 1);
    assert.equal(apply.ftsIndex.deletedRows, 2);
    assert.equal(apply.derivedMetadata.deletedRows, 3);
    assert.equal(apply.derivedMetadata.deletedNodeRows, 2);
    assert.equal(apply.derivedMetadata.deletedEdgeRows, 1);
    assert.equal(countArtifact(repoPath, seeded.deleteArtifactId), 0);
    assert.equal(countArtifactDependency(repoPath, seeded.deleteArtifactId), 0);
    assert.equal(countPackItems(repoPath, seeded.deleteArtifactId), 0);
    assert.equal(everyArtifactFileMissing(repoPath, seeded.deleteArtifactId), true);
    assert.equal(countCompressionArtifact(repoPath, seeded.deleteCompressionId), 0);
    assert.equal(countCompressionInputs(repoPath, seeded.deleteCompressionId), 0);
    assert.equal(countFtsEntries(repoPath, seeded.deleteFtsSnapshotId), 0);
    assert.equal(countFtsTextRows(repoPath, seeded.deleteFtsSnapshotId), 0);
    assert.equal(countSymbolNodes(repoPath, seeded.deleteDerivedSnapshotId), 0);
    assert.equal(countSymbolEdges(repoPath, seeded.deleteDerivedSnapshotId), 0);

    for (const protectedArtifactId of seeded.protectedArtifactIds) {
      assert.equal(countArtifact(repoPath, protectedArtifactId), 1);
      assert.equal(everyArtifactFileExists(repoPath, protectedArtifactId), true);
    }
    assert.equal(countCompressionArtifact(repoPath, seeded.protectedCompressionId), 1);
    assert.equal(countCompressionInputs(repoPath, seeded.protectedCompressionId), 1);
    assert.ok(countFtsEntries(repoPath, identitySnapshotId(repoPath)) > 0);
    assert.ok(countSymbolNodes(repoPath, identitySnapshotId(repoPath)) > 0);
  });
});

test("compact requires confirmation when only FTS rows are eligible", () => {
  withGitRepo((repoPath) => {
    runCliJson(repoPath, ["init", "--connect"]);
    const seeded = seedFtsOnlyRetention(repoPath);
    const preview = runCliJson(repoPath, ["compact"]);

    assert.equal(preview.confirmationRequired, true);
    assert.equal(preview.contextArtifacts.candidateArtifacts, 0);
    assert.equal(preview.compressionCache.candidateArtifacts, 0);
    assert.equal(preview.ftsIndex.candidateSnapshots, 1);
    assert.equal(preview.ftsIndex.candidateRows, 2);
    assert.equal(preview.ftsIndex.retentionMatchedRows, 2);
    assert.equal(preview.ftsIndex.deletedRows, 0);
    assert.equal(countFtsEntries(repoPath, seeded.deleteFtsSnapshotId), 2);

    const apply = runCliJson(repoPath, ["compact", "--confirm"]);

    assert.equal(apply.ftsIndex.deletedRows, 2);
    assert.equal(countFtsEntries(repoPath, seeded.deleteFtsSnapshotId), 0);
    assert.equal(countFtsTextRows(repoPath, seeded.deleteFtsSnapshotId), 0);
    assert.equal(countSourceRows(repoPath, seeded.deleteFtsSnapshotId), 2);
    assert.equal(countSnapshotRows(repoPath, seeded.deleteFtsSnapshotId), 1);
  });
});

test("compact requires confirmation when only derived metadata is eligible", () => {
  withGitRepo((repoPath) => {
    runCliJson(repoPath, ["init", "--connect"]);
    const seeded = seedDerivedMetadataOnlyRetention(repoPath);
    const preview = runCliJson(repoPath, ["compact"]);

    assert.equal(preview.confirmationRequired, true);
    assert.equal(preview.contextArtifacts.candidateArtifacts, 0);
    assert.equal(preview.compressionCache.candidateArtifacts, 0);
    assert.equal(preview.ftsIndex.candidateSnapshots, 0);
    assert.equal(preview.derivedMetadata.candidateSnapshots, 1);
    assert.equal(preview.derivedMetadata.candidateRows, 3);
    assert.equal(preview.derivedMetadata.deletedRows, 0);
    assert.equal(countSymbolNodes(repoPath, seeded.deleteDerivedSnapshotId), 2);
    assert.equal(countSymbolEdges(repoPath, seeded.deleteDerivedSnapshotId), 1);

    const apply = runCliJson(repoPath, ["compact", "--confirm"]);

    assert.equal(apply.derivedMetadata.deletedRows, 3);
    assert.equal(countSymbolNodes(repoPath, seeded.deleteDerivedSnapshotId), 0);
    assert.equal(countSymbolEdges(repoPath, seeded.deleteDerivedSnapshotId), 0);
    assert.equal(countSourceRows(repoPath, seeded.deleteDerivedSnapshotId), 2);
    assert.equal(countSnapshotRows(repoPath, seeded.deleteDerivedSnapshotId), 1);
  });
});

test("compact requires confirmation when only orphan snapshots are eligible", () => {
  withGitRepo((repoPath) => {
    runCliJson(repoPath, ["init", "--connect"]);
    const seeded = seedSnapshotOnlyRetention(repoPath);
    const preview = runCliJson(repoPath, ["compact"]);

    assert.equal(preview.confirmationRequired, true);
    assert.equal(preview.contextArtifacts.candidateArtifacts, 0);
    assert.equal(preview.compressionCache.candidateArtifacts, 0);
    assert.equal(preview.ftsIndex.candidateSnapshots, 0);
    assert.equal(preview.derivedMetadata.candidateSnapshots, 0);
    assert.equal(preview.snapshots.candidateSnapshots, 1);
    assert.equal(preview.snapshots.deletedSnapshots, 0);
    assert.equal(preview.snapshots.rowCounts.repoSnapshots, 1);
    assert.equal(preview.snapshots.rowCounts.worktreeStates, 1);
    assert.equal(countSnapshotRows(repoPath, seeded.deleteSnapshotId), 1);
    assert.equal(countWorktreeRows(repoPath, seeded.deleteSnapshotId), 1);

    const apply = runCliJson(repoPath, ["compact", "--confirm"]);

    assert.equal(apply.snapshots.deletedSnapshots, 1);
    assert.equal(countSnapshotRows(repoPath, seeded.deleteSnapshotId), 0);
    assert.equal(countWorktreeRows(repoPath, seeded.deleteSnapshotId), 0);
  });
});

test("compact rechecks orphan snapshots after artifact deletion", () => {
  withGitRepo((repoPath) => {
    runCliJson(repoPath, ["init", "--connect"]);
    const seeded = seedArtifactOwnedSnapshotRetention(repoPath);
    const preview = runCliJson(repoPath, ["compact"]);

    assert.equal(preview.confirmationRequired, true);
    assert.equal(preview.contextArtifacts.candidateArtifacts, 1);
    assert.equal(preview.snapshots.candidateSnapshots, 1);
    assert.equal(countArtifact(repoPath, seeded.deleteArtifactId), 1);
    assert.equal(countSnapshotRows(repoPath, seeded.deleteSnapshotId), 1);

    const apply = runCliJson(repoPath, ["compact", "--confirm"]);

    assert.equal(apply.contextArtifacts.deletedArtifacts, 1);
    assert.equal(apply.snapshots.deletedSnapshots, 1);
    assert.equal(countArtifact(repoPath, seeded.deleteArtifactId), 0);
    assert.equal(countSnapshotRows(repoPath, seeded.deleteSnapshotId), 0);
    assert.equal(countWorktreeRows(repoPath, seeded.deleteSnapshotId), 0);
  });
});

function seedRetentionArtifacts(repoPath) {
  const databasePath = path.join(repoPath, ".grape", "grape.db");
  const database = new DatabaseSync(databasePath);
  try {
    const identity = readIdentity(database);
    const repositories = createStorageRepositories(database);
    const compressionRepositories = createCompressionStorageRepositories(database);
    const evidenceRepositories = createEvidenceStorageRepositories(database);
    const indexingRepositories = createIndexingStorageRepositories(database);
    const deleteArtifactId = "artifact:compact-delete-old";
    const deleteCompressionId = "compression:compact-delete-old";
    const deleteFtsSnapshotId = "snapshot:compact-fts-old";
    const deleteDerivedSnapshotId = "snapshot:compact-derived-old";
    const protectedCompressionId = "compression:compact-protected-old";
    const protectedArtifactIds = [
      "artifact:compact-latest-old",
      "artifact:compact-active-old",
      "artifact:compact-restorable-old",
      "artifact:compact-locked-old"
    ];

    insertSession(repositories, identity, "compact-delete-session", "unlocked");
    insertArtifact(repositories, identity, deleteArtifactId, "compact-delete-session", oldTime);
    insertArtifact(repositories, identity, "artifact:compact-delete-new", "compact-delete-session", newTime);
    repositories.contextDependencies.insert({
      dependencyId: "dependency:compact-delete-old",
      artifactId: deleteArtifactId,
      dependencyKind: "file",
      dependencyRef: "README.md",
      dependencyHash: "hash:readme",
      scopeJson: "{}",
      createdAt: oldTime
    });
    repositories.contextPackItems.insert({
      packItemId: "pack:compact-delete-old",
      sessionId: "compact-delete-session",
      artifactId: deleteArtifactId,
      sectionId: "section-delete",
      diffState: "NEW",
      itemKind: "code_span",
      itemRef: "README.md",
      contentHash: "hash:pack",
      tokenCount: 1,
      pinned: false,
      safetyCritical: false,
      inputRefsJson: "[]",
      createdAt: oldTime
    });

    insertSession(repositories, identity, "compact-latest-session", "unlocked");
    insertArtifact(repositories, identity, "artifact:compact-latest-old", "compact-latest-session", oldTime);

    insertSession(repositories, identity, "compact-active-session", "unlocked");
    insertArtifact(repositories, identity, "artifact:compact-active-old", "compact-active-session", oldTime);
    insertArtifact(repositories, identity, "artifact:compact-active-new", "compact-active-session", newTime);
    repositories.contextSentItems.insert({
      sentItemId: "sent:compact-active-old",
      sessionId: "compact-active-session",
      artifactId: "artifact:compact-active-old",
      sectionId: "section-active",
      taskId: "task:compact",
      itemKind: "code_span",
      itemRef: "README.md",
      itemHash: "hash:item",
      contentHash: "hash:content",
      branchName: "main",
      commitSha: "HEAD",
      dependencyManifestHash: "hash:manifest",
      wasPinned: false,
      lastDiffState: "NEW",
      firstSentAt: oldTime,
      lastSentAt: oldTime,
      sendCount: 1,
      tokenCount: 1
    });

    insertSession(repositories, identity, "compact-restorable-session", "unlocked");
    insertArtifact(repositories, identity, "artifact:compact-restorable-old", "compact-restorable-session", oldTime);
    insertArtifact(repositories, identity, "artifact:compact-restorable-new", "compact-restorable-session", newTime);
    repositories.omittedContextItems.insert({
      omittedItemId: "omitted:compact-restorable-old",
      sessionId: "compact-restorable-session",
      artifactId: "artifact:compact-restorable-old",
      sectionId: "section-restorable",
      itemKind: "code_span",
      itemRef: "README.md",
      itemHash: "hash:item",
      contentHash: "hash:content",
      branchName: "main",
      commitSha: "HEAD",
      dependencyManifestHash: "hash:manifest",
      lastDiffState: "OMIT_UNCHANGED",
      reasonOmitted: "unchanged_restorable",
      canRestore: true,
      restoreId: "restore-compact",
      restoreCommand: "grape omitted --session compact-restorable-session --token restore-compact",
      omittedAt: oldTime,
      sendCount: 1,
      tokenCount: 1
    });

    insertSession(repositories, identity, "compact-locked-session", "locked");
    insertArtifact(repositories, identity, "artifact:compact-locked-old", "compact-locked-session", oldTime);
    insertArtifact(repositories, identity, "artifact:compact-locked-new", "compact-locked-session", newTime);

    insertCompressionArtifact(compressionRepositories, identity, deleteCompressionId, oldTime, 2);
    insertCompressionArtifact(compressionRepositories, identity, protectedCompressionId, oldTime, 1);
    insertFtsSnapshot(repositories, identity, deleteFtsSnapshotId, oldTime);
    insertFtsRows({
      evidenceRepositories,
      indexingRepositories,
      identity,
      snapshotId: deleteFtsSnapshotId,
      createdAt: oldTime,
      count: 2
    });
    insertFtsSnapshot(repositories, identity, deleteDerivedSnapshotId, oldTime);
    insertSymbolRows({
      evidenceRepositories,
      indexingRepositories,
      identity,
      snapshotId: deleteDerivedSnapshotId,
      createdAt: oldTime,
      nodeCount: 2,
      edgeCount: 1
    });
    insertSymbolRows({
      evidenceRepositories,
      indexingRepositories,
      identity,
      snapshotId: identity.snapshotId,
      createdAt: newTime,
      nodeCount: 1,
      edgeCount: 0
    });
    repositories.contextDependencies.insert({
      dependencyId: "dependency:compact-protected-compression",
      artifactId: "artifact:compact-active-old",
      dependencyKind: "compression_artifact",
      dependencyRef: protectedCompressionId,
      dependencyHash: `hash:${protectedCompressionId}`,
      scopeJson: "{}",
      createdAt: oldTime
    });

    for (const artifactId of [
      deleteArtifactId,
      ...protectedArtifactIds
    ]) {
      writeArtifactFiles(repoPath, artifactId);
    }

    return {
      deleteArtifactId,
      deleteCompressionId,
      deleteFtsSnapshotId,
      deleteDerivedSnapshotId,
      protectedArtifactIds,
      protectedCompressionId
    };
  } finally {
    database.close();
  }
}

function seedSnapshotOnlyRetention(repoPath) {
  const databasePath = path.join(repoPath, ".grape", "grape.db");
  const database = new DatabaseSync(databasePath);
  try {
    const identity = readIdentity(database);
    const repositories = createStorageRepositories(database);
    const deleteSnapshotId = "snapshot:compact-orphan-only-old";

    insertFtsSnapshot(repositories, identity, deleteSnapshotId, oldTime);

    return { deleteSnapshotId };
  } finally {
    database.close();
  }
}

function seedArtifactOwnedSnapshotRetention(repoPath) {
  const databasePath = path.join(repoPath, ".grape", "grape.db");
  const database = new DatabaseSync(databasePath);
  try {
    const identity = readIdentity(database);
    const repositories = createStorageRepositories(database);
    const deleteSnapshotId = "snapshot:compact-artifact-orphan-old";
    const deleteArtifactId = "artifact:compact-artifact-orphan-old";
    const keepArtifactId = "artifact:compact-artifact-orphan-new";
    const sessionId = "compact-artifact-orphan-session";

    insertFtsSnapshot(repositories, identity, deleteSnapshotId, oldTime);
    insertSession(repositories, identity, sessionId, "unlocked");
    insertArtifact(repositories, identity, deleteArtifactId, sessionId, oldTime, deleteSnapshotId);
    insertArtifact(repositories, identity, keepArtifactId, sessionId, newTime);

    return { deleteSnapshotId, deleteArtifactId };
  } finally {
    database.close();
  }
}

function seedFtsOnlyRetention(repoPath) {
  const databasePath = path.join(repoPath, ".grape", "grape.db");
  const database = new DatabaseSync(databasePath);
  try {
    const identity = readIdentity(database);
    const repositories = createStorageRepositories(database);
    const evidenceRepositories = createEvidenceStorageRepositories(database);
    const indexingRepositories = createIndexingStorageRepositories(database);
    const deleteFtsSnapshotId = "snapshot:compact-fts-only-old";

    insertFtsSnapshot(repositories, identity, deleteFtsSnapshotId, oldTime);
    insertFtsRows({
      evidenceRepositories,
      indexingRepositories,
      identity,
      snapshotId: deleteFtsSnapshotId,
      createdAt: oldTime,
      count: 2
    });

    return { deleteFtsSnapshotId };
  } finally {
    database.close();
  }
}

function seedDerivedMetadataOnlyRetention(repoPath) {
  const databasePath = path.join(repoPath, ".grape", "grape.db");
  const database = new DatabaseSync(databasePath);
  try {
    const identity = readIdentity(database);
    const repositories = createStorageRepositories(database);
    const evidenceRepositories = createEvidenceStorageRepositories(database);
    const indexingRepositories = createIndexingStorageRepositories(database);
    const deleteDerivedSnapshotId = "snapshot:compact-derived-only-old";

    insertFtsSnapshot(repositories, identity, deleteDerivedSnapshotId, oldTime);
    insertSymbolRows({
      evidenceRepositories,
      indexingRepositories,
      identity,
      snapshotId: deleteDerivedSnapshotId,
      createdAt: oldTime,
      nodeCount: 2,
      edgeCount: 1
    });

    return { deleteDerivedSnapshotId };
  } finally {
    database.close();
  }
}

function readIdentity(database) {
  return {
    projectId: stringRow(database, "SELECT project_id AS value FROM projects LIMIT 1"),
    repoId: stringRow(database, "SELECT repo_id AS value FROM repos LIMIT 1"),
    snapshotId: stringRow(database, "SELECT snapshot_id AS value FROM repo_snapshots LIMIT 1"),
    worktreeStateId: stringRow(database, "SELECT worktree_state_id AS value FROM worktree_states LIMIT 1")
  };
}

function insertFtsSnapshot(repositories, identity, snapshotId, createdAt) {
  repositories.repoSnapshots.insert({
    snapshotId,
    repoId: identity.repoId,
    branch: "main",
    commitSha: "fts-old",
    worktreeHash: "hash:fts-old",
    snapshotHash: "hash:fts-old-snapshot",
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

function insertSession(repositories, identity, sessionId, lockStatus) {
  repositories.contextSessions.insert({
    sessionId,
    projectId: identity.projectId,
    repoId: identity.repoId,
    repoSnapshotId: identity.snapshotId,
    worktreeStateId: identity.worktreeStateId,
    agentName: "codex",
    agentSessionId: sessionId,
    taskId: "task:compact",
    taskType: "analysis",
    branchName: "main",
    headCommitSha: "HEAD",
    status: "active",
    lockStatus,
    lockToken: lockStatus === "locked" ? `lock:${sessionId}` : undefined,
    startedAt: oldTime,
    lastSeenAt: oldTime,
    createdAt: oldTime,
    updatedAt: oldTime
  });
}

function insertFtsRows(input) {
  for (let index = 0; index < input.count; index += 1) {
    const sourceId = `source:${input.snapshotId}:${index}`;
    input.evidenceRepositories.sources.insertOrIgnore({
      sourceId,
      snapshotId: input.snapshotId,
      sourceType: "repository_file",
      sourceRef: `src/compact-fts-${index}.ts`,
      sourceHash: `hash:compact-fts-source:${index}`,
      sourceScope: "committed",
      trustClass: "trusted",
      privacyStatus: "allowed",
      redactionStatus: "not_needed",
      metadataJson: "{}",
      createdAt: input.createdAt
    });
    input.indexingRepositories.ftsEntries.insertOrIgnore({
      ftsEntryId: `fts:${input.snapshotId}:${index}`,
      projectId: input.identity.projectId,
      repoId: input.identity.repoId,
      snapshotId: input.snapshotId,
      sourceId,
      sourceRef: `src/compact-fts-${index}.ts`,
      sourceType: "repository_file",
      sourceHash: `hash:compact-fts-source:${index}`,
      textHash: `hash:compact-fts-text:${index}`,
      metadataJson: "{}",
      createdAt: input.createdAt,
      body: `compact fts body ${index}`
    });
  }
}

function insertSymbolRows(input) {
  for (let index = 0; index < input.nodeCount; index += 1) {
    const sourceId = `source:symbol:${input.snapshotId}:${index}`;
    input.evidenceRepositories.sources.insertOrIgnore({
      sourceId,
      snapshotId: input.snapshotId,
      sourceType: "repository_file",
      sourceRef: `src/compact-symbol-${index}.ts`,
      sourceHash: `hash:compact-symbol-source:${input.snapshotId}:${index}`,
      sourceScope: "committed",
      trustClass: "trusted",
      privacyStatus: "allowed",
      redactionStatus: "not_needed",
      metadataJson: "{}",
      createdAt: input.createdAt
    });
    input.indexingRepositories.symbolNodes.insertOrIgnore({
      symbolId: `symbol:${input.snapshotId}:${index}`,
      projectId: input.identity.projectId,
      repoId: input.identity.repoId,
      snapshotId: input.snapshotId,
      sourceId,
      path: `src/compact-symbol-${index}.ts`,
      language: "typescript",
      name: `symbol${index}`,
      symbolKind: index === 0 ? "module" : "function",
      startLine: 1,
      endLine: 1,
      bodyHash: `hash:compact-symbol-body:${input.snapshotId}:${index}`,
      signatureHash: `hash:compact-symbol-signature:${input.snapshotId}:${index}`,
      confidence: "high",
      metadataJson: "{}",
      createdAt: input.createdAt
    });
  }

  for (let index = 0; index < input.edgeCount; index += 1) {
    input.indexingRepositories.symbolEdges.insertOrIgnore({
      edgeId: `symbol_edge:${input.snapshotId}:${index}`,
      projectId: input.identity.projectId,
      repoId: input.identity.repoId,
      snapshotId: input.snapshotId,
      fromSymbolId: `symbol:${input.snapshotId}:0`,
      toSymbolId: input.nodeCount > 1 ? `symbol:${input.snapshotId}:1` : undefined,
      toRef: input.nodeCount > 1 ? undefined : `./compact-symbol-${index}`,
      edgeType: "imports",
      confidence: "high",
      discoveryMethod: "ast",
      metadataJson: "{}",
      createdAt: input.createdAt
    });
  }
}

function insertArtifact(repositories, identity, artifactId, sessionId, createdAt, snapshotId = identity.snapshotId) {
  repositories.contextArtifacts.insert({
    artifactId,
    sessionId,
    snapshotId,
    artifactHash: `hash:${artifactId}`,
    dependencyManifestHash: "hash:manifest",
    taskType: "analysis",
    riskOverlaysJson: "[]",
    warningsJson: "[]",
    unsafeReasonsJson: "[]",
    createdAt
  });
}

function insertCompressionArtifact(repositories, identity, compressionId, createdAt, inputCount) {
  repositories.compressionArtifacts.upsert({
    compressionId,
    projectId: identity.projectId,
    repoId: identity.repoId,
    repoSnapshotId: identity.snapshotId,
    worktreeStateId: identity.worktreeStateId,
    artifactType: "symbol_outline",
    method: "deterministic",
    summaryText: `summary:${compressionId}`,
    inputHash: `hash:input:${compressionId}`,
    policyHash: "hash:policy",
    scopeHash: "hash:scope",
    outputHash: `hash:${compressionId}`,
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
      inputHash: `hash:input:${index}`
    });
  }
}

function writeArtifactFiles(repoPath, artifactId) {
  const artifactDir = path.join(repoPath, ".grape", "artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const baseName = artifactFileBaseName(artifactId);
  writeFileSync(path.join(artifactDir, `${baseName}.json`), JSON.stringify({ artifactId }));
  writeFileSync(path.join(artifactDir, `${baseName}.md`), `# ${artifactId}\n`);
  writeFileSync(path.join(artifactDir, `${baseName}.repository.json`), JSON.stringify({ artifactId }));
}

function everyArtifactFileExists(repoPath, artifactId) {
  return artifactFilePaths(repoPath, artifactId).every((filePath) => existsSync(filePath));
}

function everyArtifactFileMissing(repoPath, artifactId) {
  return artifactFilePaths(repoPath, artifactId).every((filePath) => !existsSync(filePath));
}

function artifactFilePaths(repoPath, artifactId) {
  const artifactDir = path.join(repoPath, ".grape", "artifacts");
  const baseName = artifactFileBaseName(artifactId);
  return [
    path.join(artifactDir, `${baseName}.json`),
    path.join(artifactDir, `${baseName}.md`),
    path.join(artifactDir, `${baseName}.repository.json`)
  ];
}

function countArtifact(repoPath, artifactId) {
  return countRows(repoPath, "context_artifacts", "artifact_id", artifactId);
}

function countArtifactDependency(repoPath, artifactId) {
  return countRows(repoPath, "context_dependencies", "artifact_id", artifactId);
}

function countPackItems(repoPath, artifactId) {
  return countRows(repoPath, "context_pack_items", "artifact_id", artifactId);
}

function countCompressionArtifact(repoPath, compressionId) {
  return countRows(repoPath, "compression_artifacts", "compression_id", compressionId);
}

function countCompressionInputs(repoPath, compressionId) {
  return countRows(repoPath, "compression_inputs", "compression_id", compressionId);
}

function countFtsEntries(repoPath, snapshotId) {
  return countRows(repoPath, "fts_entries", "snapshot_id", snapshotId);
}

function countFtsTextRows(repoPath, snapshotId) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
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
  } finally {
    database.close();
  }
}

function countSymbolNodes(repoPath, snapshotId) {
  return countRows(repoPath, "symbol_nodes", "snapshot_id", snapshotId);
}

function countSymbolEdges(repoPath, snapshotId) {
  return countRows(repoPath, "symbol_edges", "snapshot_id", snapshotId);
}

function identitySnapshotId(repoPath) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    return stringRow(database, "SELECT snapshot_id AS value FROM repo_snapshots ORDER BY created_at DESC LIMIT 1");
  } finally {
    database.close();
  }
}

function countSourceRows(repoPath, snapshotId) {
  return countRows(repoPath, "sources", "snapshot_id", snapshotId);
}

function countSnapshotRows(repoPath, snapshotId) {
  return countRows(repoPath, "repo_snapshots", "snapshot_id", snapshotId);
}

function countWorktreeRows(repoPath, snapshotId) {
  return countRows(repoPath, "worktree_states", "snapshot_id", snapshotId);
}

function countRows(repoPath, tableName, columnName, value) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    const row = database
      .prepare(`SELECT count(*) AS count FROM ${tableName} WHERE ${columnName} = ?`)
      .get(value);
    return Number(row.count);
  } finally {
    database.close();
  }
}

function stringRow(database, sql) {
  const row = database.prepare(sql).get();
  assert.equal(typeof row.value, "string");
  return row.value;
}
