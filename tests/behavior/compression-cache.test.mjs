import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { buildSymbolOutlineCompressionArtifact } from "../../.tmp/build/src/core/compression/index.js";
import {
  applyStorageMigrations,
  createCompressionStorageRepositories,
  createStorageRepositories,
  storageMigrationReferences
} from "../../.tmp/build/src/core/storage/index.js";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const now = "2026-05-26T00:00:00.000Z";

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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-compression-"));
  const database = new DatabaseSync(path.join(dir, "grape.db"));

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    const repositories = createStorageRepositories(database);
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
    fn(createCompressionStorageRepositories(database));
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function symbolOutlineInput(overrides = {}) {
  return {
    projectId: "project-1",
    repoId: "repo-1",
    snapshotId: "snapshot-1",
    worktreeStateId: "worktree-1",
    branch: "main",
    commit: "abc123",
    worktreeHash: hashA,
    symbolNodes: [
      {
        symbolId: "symbol:module",
        path: "src/app.ts",
        name: "src/app.ts",
        symbolKind: "module",
        confidence: "high",
        bodyHash: hashA
      }
    ],
    symbolEdges: [
      {
        edgeId: "symbol_edge:imports",
        edgeType: "imports",
        fromSymbolId: "symbol:module",
        toRef: "src/lib.ts"
      }
    ],
    createdAt: now,
    ...overrides
  };
}

test("deterministic symbol outline compression artifacts track input hashes", () => {
  const first = buildSymbolOutlineCompressionArtifact(symbolOutlineInput());
  const second = buildSymbolOutlineCompressionArtifact(symbolOutlineInput());
  const changed = buildSymbolOutlineCompressionArtifact(
    symbolOutlineInput({
      symbolEdges: [
        {
          edgeId: "symbol_edge:imports",
          edgeType: "imports",
          fromSymbolId: "symbol:module",
          toRef: "src/changed.ts"
        }
      ]
    })
  );

  assert.ok(first);
  assert.ok(second);
  assert.ok(changed);
  assert.equal(first.compressionId, second.compressionId);
  assert.equal(first.outputHash, second.outputHash);
  assert.notEqual(first.outputHash, changed.outputHash);
  assert.equal(first.type, "symbol_outline");
  assert.equal(first.method, "deterministic");
  assert.equal(first.inputHashes.length, 2);
  assert.match(first.summaryText, /Indexed symbol nodes: 1/);
});

test("compression storage persists deterministic artifacts and their input hashes", () => {
  withMigratedDatabase((repositories) => {
    const artifact = buildSymbolOutlineCompressionArtifact(symbolOutlineInput());
    assert.ok(artifact);

    repositories.compressionArtifacts.upsert({
      compressionId: artifact.compressionId,
      projectId: artifact.projectId,
      repoId: artifact.repoId,
      repoSnapshotId: artifact.snapshotId,
      worktreeStateId: artifact.worktreeStateId,
      artifactType: artifact.type,
      method: artifact.method,
      summaryText: artifact.summaryText,
      inputHash: artifact.inputHash,
      policyHash: artifact.policyHash,
      scopeHash: artifact.scopeHash,
      outputHash: artifact.outputHash,
      trustStatus: "derived_cache",
      createdAt: artifact.createdAt,
      updatedAt: artifact.createdAt
    });

    for (const ref of artifact.inputRefs) {
      repositories.compressionInputs.upsert({
        compressionInputId: `input:${ref.ref}`,
        compressionId: artifact.compressionId,
        inputKind: ref.kind,
        inputRef: ref.ref,
        inputHash: ref.hash
      });
    }

    assert.equal(repositories.compressionArtifacts.get(artifact.compressionId)?.outputHash, artifact.outputHash);
    assert.equal(repositories.compressionArtifacts.listBySnapshot("snapshot-1").length, 1);
    assert.deepEqual(
      repositories.compressionInputs.listByArtifact(artifact.compressionId).map((input) => input.inputKind),
      ["symbol", "symbol"]
    );
  });
});
