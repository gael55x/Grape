import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  applyStorageMigrations,
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createStorageRepositories,
  storageMigrationReferences
} from "../../../.tmp/build/src/core/storage/index.js";

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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-fts-search-db-"));
  const database = new DatabaseSync(path.join(dir, "grape.db"));

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    fn(
      createStorageRepositories(database),
      createEvidenceStorageRepositories(database),
      createIndexingStorageRepositories(database)
    );
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function insertSnapshot(repositories) {
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
    worktreeHash: sha256("worktree"),
    snapshotHash: sha256("snapshot"),
    dirtyState: "clean",
    createdAt: now
  });
}

function insertLexicalRow(evidenceRepositories, indexingRepositories, index, body) {
  const padded = String(index).padStart(4, "0");
  const sourceId = `source:${padded}`;
  const sourceRef = `src/${padded}.ts`;
  const sourceHash = sha256(`source:${padded}`);

  evidenceRepositories.sources.insertOrIgnore({
    sourceId,
    snapshotId: "snapshot-1",
    sourceType: "repository_file",
    sourceRef,
    sourceHash,
    sourceScope: "committed",
    trustClass: "trusted",
    privacyStatus: "allowed",
    redactionStatus: "not_needed",
    metadataJson: "{}",
    createdAt: now
  });

  indexingRepositories.ftsEntries.insertOrIgnore({
    ftsEntryId: `fts:${padded}`,
    projectId: "project-1",
    repoId: "repo-1",
    snapshotId: "snapshot-1",
    sourceId,
    sourceRef,
    sourceType: "repository_file",
    sourceHash,
    textHash: sha256(body),
    metadataJson: "{}",
    createdAt: now,
    body
  });
}

test("lexical search keeps punctuation-normalized fallback bounded", () => {
  withMigratedDatabase((repositories, evidenceRepositories, indexingRepositories) => {
    insertSnapshot(repositories);

    for (let index = 0; index <= 300; index += 1) {
      const body = index === 5 || index === 300
        ? "export const value = 'bounded$needle';"
        : `export const value${index} = ${index};`;
      insertLexicalRow(evidenceRepositories, indexingRepositories, index, body);
    }

    const matches = indexingRepositories.ftsEntries.searchSnapshot("snapshot-1", "boundedNeedle", 8);
    const sourceRefs = matches.map((entry) => entry.sourceRef);

    assert.deepEqual(sourceRefs, ["src/0005.ts"]);
    assert.equal(sourceRefs.includes("src/0300.ts"), false);
  });
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
