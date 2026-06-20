import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createStorageRepositories } from "../../../.tmp/build/src/core/storage/index.js";
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

test("compact help documents preview and confirm behavior", () => {
  const help = runCli(process.cwd(), ["compact", "--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /grape compact --confirm/);
  assert.match(help.stdout, /Without --confirm, no data is deleted/);
  assert.match(help.stdout, /does not delete snapshots, FTS rows, compression rows/);

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
    assert.equal(countArtifact(repoPath, seeded.deleteArtifactId), 1);
    assert.equal(everyArtifactFileExists(repoPath, seeded.deleteArtifactId), true);

    const apply = runCliJson(repoPath, ["compact", "--confirm"]);

    assert.equal(apply.dryRun, false);
    assert.equal(apply.applied, true);
    assert.equal(apply.confirmationRequired, false);
    assert.equal(apply.contextArtifacts.candidateArtifacts, 1);
    assert.equal(apply.contextArtifacts.deletedArtifacts, 1);
    assert.equal(apply.contextArtifacts.artifactFiles.deletedFiles, 3);
    assert.equal(countArtifact(repoPath, seeded.deleteArtifactId), 0);
    assert.equal(countArtifactDependency(repoPath, seeded.deleteArtifactId), 0);
    assert.equal(countPackItems(repoPath, seeded.deleteArtifactId), 0);
    assert.equal(everyArtifactFileMissing(repoPath, seeded.deleteArtifactId), true);

    for (const protectedArtifactId of seeded.protectedArtifactIds) {
      assert.equal(countArtifact(repoPath, protectedArtifactId), 1);
      assert.equal(everyArtifactFileExists(repoPath, protectedArtifactId), true);
    }
  });
});

function seedRetentionArtifacts(repoPath) {
  const databasePath = path.join(repoPath, ".grape", "grape.db");
  const database = new DatabaseSync(databasePath);
  try {
    const identity = readIdentity(database);
    const repositories = createStorageRepositories(database);
    const deleteArtifactId = "artifact:compact-delete-old";
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

    for (const artifactId of [
      deleteArtifactId,
      ...protectedArtifactIds
    ]) {
      writeArtifactFiles(repoPath, artifactId);
    }

    return { deleteArtifactId, protectedArtifactIds };
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

function insertArtifact(repositories, identity, artifactId, sessionId, createdAt) {
  repositories.contextArtifacts.insert({
    artifactId,
    sessionId,
    snapshotId: identity.snapshotId,
    artifactHash: `hash:${artifactId}`,
    dependencyManifestHash: "hash:manifest",
    taskType: "analysis",
    riskOverlaysJson: "[]",
    warningsJson: "[]",
    unsafeReasonsJson: "[]",
    createdAt
  });
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
