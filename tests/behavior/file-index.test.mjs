import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { persistGitRepoSnapshot } from "../../.tmp/build/src/app/index.js";
import { buildFileIndex } from "../../.tmp/build/src/core/indexing/index.js";
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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-file-index-db-"));
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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-file-index-repo-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, ".aiignore"), "private.ts\n");
    writeFileSync(
      path.join(dir, "src", "lib.ts"),
      ["export class Calculator {}", "export function calculateDiscount() { return 10; }", ""].join("\n")
    );
    writeFileSync(
      path.join(dir, "src", "app.ts"),
      [
        "import { calculateDiscount } from './lib';",
        "import outside from '../../../outside';",
        "const localValue = calculateDiscount();",
        "export function runApp() { return localValue; }",
        ""
      ].join("\n")
    );
    writeFileSync(path.join(dir, "src", "secret.ts"), "export const leaked = 'TOKEN=value';\n");
    writeFileSync(path.join(dir, "private.ts"), "export const privateToken = 'PRIVATE=value';\n");
    execGit(dir, ["add", ".aiignore", "src/lib.ts", "src/app.ts", "src/secret.ts", "private.ts"]);
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

test("snapshot file indexing persists module nodes, symbols, and import relationships", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
      const result = persistGitRepoSnapshot({
        database,
        repositories,
        evidenceRepositories,
        indexingRepositories,
        rootPath: repoPath,
        projectId: "project-1",
        repoId: "repo-1",
        now
      });

      const nodes = indexingRepositories.symbolNodes.listBySnapshot(result.snapshotId);
      const edges = indexingRepositories.symbolEdges.listBySnapshot(result.snapshotId);
      const ftsEntries = indexingRepositories.ftsEntries.listBySnapshot(result.snapshotId);
      const ftsMatches = indexingRepositories.ftsEntries.searchSnapshot(result.snapshotId, "calculateDiscount");
      const secretMatches = indexingRepositories.ftsEntries.searchSnapshot(result.snapshotId, "TOKEN");
      const nodeByPathAndName = new Map(nodes.map((node) => [`${node.path}:${node.name}`, node]));
      const appModule = nodeByPathAndName.get("src/app.ts:src/app.ts");
      const libModule = nodeByPathAndName.get("src/lib.ts:src/lib.ts");

      assert.equal(result.index.nodesInserted, nodes.length);
      assert.equal(result.index.edgesInserted, edges.length);
      assert.equal(result.index.ftsEntriesInserted, ftsEntries.length);
      assert.equal(ftsEntries.some((entry) => entry.sourceRef === "src/app.ts"), true);
      assert.equal(ftsEntries.some((entry) => entry.sourceRef === "src/secret.ts"), false);
      assert.equal(ftsMatches.some((entry) => entry.sourceRef === "src/app.ts"), true);
      assert.equal(secretMatches.length, 0);
      assert.equal(appModule?.symbolKind, "module");
      assert.equal(libModule?.symbolKind, "module");
      assert.equal(nodeByPathAndName.get("src/app.ts:runApp")?.symbolKind, "function");
      assert.equal(nodeByPathAndName.get("src/app.ts:localValue")?.symbolKind, "constant");
      assert.equal(nodeByPathAndName.get("src/lib.ts:Calculator")?.symbolKind, "class");
      assert.equal(nodeByPathAndName.get("src/lib.ts:calculateDiscount")?.symbolKind, "function");
      assert.equal(nodes.some((node) => node.path === "private.ts"), false);
      assert.ok(nodes.every((node) => typeof node.sourceId === "string" && node.sourceId.startsWith("source:")));

      assert.ok(
        edges.some(
          (edge) =>
            edge.edgeType === "contains" &&
            edge.fromSymbolId === appModule?.symbolId &&
            edge.toSymbolId === nodeByPathAndName.get("src/app.ts:runApp")?.symbolId
        )
      );
      assert.ok(
        edges.some(
          (edge) =>
            edge.edgeType === "imports" &&
            edge.fromSymbolId === appModule?.symbolId &&
            edge.toSymbolId === libModule?.symbolId &&
            edge.toRef === "src/lib.ts"
        )
      );
      assert.ok(
        edges.some(
          (edge) =>
            edge.edgeType === "imports" &&
            edge.fromSymbolId === appModule?.symbolId &&
            edge.toSymbolId === undefined &&
            edge.toRef === "../../../outside" &&
            edge.confidence === "low"
        )
      );

      const persistedText = JSON.stringify({ nodes, edges });
      assert.equal(persistedText.includes("PRIVATE=value"), false);
      assert.equal(JSON.stringify({ ftsEntries, ftsMatches, secretMatches }).includes("TOKEN=value"), false);
    });
  });
});

test("file indexing skips symlinks without reading target contents", () => {
  const rootPath = mkdtempSync(path.join(tmpdir(), "grape-file-index-symlink-"));
  const externalPath = path.join(tmpdir(), `grape-file-index-private-${process.pid}.ts`);

  try {
    mkdirSync(path.join(rootPath, "src"), { recursive: true });
    writeFileSync(externalPath, "export const privateToken = 'PRIVATE=value';\n");
    try {
      symlinkSync(externalPath, path.join(rootPath, "src", "external.ts"));
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EACCES") return;
      throw error;
    }

    const result = buildFileIndex({
      projectId: "project-1",
      repoId: "repo-1",
      snapshotId: "snapshot-1",
      rootPath,
      files: [
        {
          path: "src/external.ts",
          sha256: sha256(Buffer.from(`symlink:${externalPath}`)),
          sourceKind: "source",
          sourceId: "source:external"
        }
      ],
      createdAt: now
    });

    assert.deepEqual(result.nodes, []);
    assert.deepEqual(result.edges, []);
    assert.deepEqual(result.skipped, [{ path: "src/external.ts", reason: "symlink" }]);
    assert.equal(JSON.stringify(result).includes("PRIVATE=value"), false);
  } finally {
    rmSync(rootPath, { recursive: true, force: true });
    rmSync(externalPath, { force: true });
  }
});

test("file indexing skips files that no longer match the snapshot hash", () => {
  const rootPath = mkdtempSync(path.join(tmpdir(), "grape-file-index-hash-"));

  try {
    mkdirSync(path.join(rootPath, "src"), { recursive: true });
    writeFileSync(path.join(rootPath, "src", "changed.ts"), "export const changed = true;\n");

    const result = buildFileIndex({
      projectId: "project-1",
      repoId: "repo-1",
      snapshotId: "snapshot-1",
      rootPath,
      files: [
        {
          path: "src/changed.ts",
          sha256: sha256(Buffer.from("export const changed = false;\n")),
          sourceKind: "source",
          sourceId: "source:changed"
        }
      ],
      createdAt: now
    });

    assert.deepEqual(result.nodes, []);
    assert.deepEqual(result.edges, []);
    assert.deepEqual(result.skipped, [{ path: "src/changed.ts", reason: "hash_mismatch" }]);
  } finally {
    rmSync(rootPath, { recursive: true, force: true });
  }
});

test("file indexing skips binary files without storing raw bytes", () => {
  const rootPath = mkdtempSync(path.join(tmpdir(), "grape-file-index-binary-"));

  try {
    mkdirSync(path.join(rootPath, "src"), { recursive: true });
    const bytes = Buffer.from([0, 1, 2, 3]);
    writeFileSync(path.join(rootPath, "src", "binary.ts"), bytes);

    const result = buildFileIndex({
      projectId: "project-1",
      repoId: "repo-1",
      snapshotId: "snapshot-1",
      rootPath,
      files: [
        {
          path: "src/binary.ts",
          sha256: sha256(bytes),
          sourceKind: "source",
          sourceId: "source:binary"
        }
      ],
      createdAt: now
    });

    assert.deepEqual(result.nodes, []);
    assert.deepEqual(result.edges, []);
    assert.deepEqual(result.skipped, [{ path: "src/binary.ts", reason: "binary" }]);
  } finally {
    rmSync(rootPath, { recursive: true, force: true });
  }
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("snapshot file indexing is idempotent for unchanged snapshots", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
      persistGitRepoSnapshot({
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

      assert.equal(second.index.nodesInserted, 0);
      assert.equal(second.index.edgesInserted, 0);
      assert.equal(second.index.ftsEntriesInserted, 0);
    });
  });
});
