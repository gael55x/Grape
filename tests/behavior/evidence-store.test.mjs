import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { persistGitRepoSnapshot } from "../../.tmp/build/src/app/index.js";
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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-evidence-store-db-"));
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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-evidence-store-repo-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    mkdirSync(path.join(dir, ".grape"), { recursive: true });
    mkdirSync(path.join(dir, "src"), { recursive: true });
    mkdirSync(path.join(dir, "node_modules", "package"), { recursive: true });
    writeFileSync(path.join(dir, ".gitignore"), "ignored.env\nnode_modules/\n");
    writeFileSync(path.join(dir, ".aiignore"), "private.txt\n");
    writeFileSync(path.join(dir, ".grape", "rules.md"), "Never store raw secrets.\n");
    writeFileSync(path.join(dir, "src", "app.ts"), "export const app = true;\n");
    writeFileSync(path.join(dir, "package-lock.json"), "{\"lockfileVersion\":3}\n");
    writeFileSync(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    writeFileSync(path.join(dir, "ignored.env"), "SECRET=forced-tracked\n");
    writeFileSync(path.join(dir, "private.txt"), "PRIVATE=value\n");
    writeFileSync(path.join(dir, "node_modules", "package", "index.js"), "SECRET=ignored-dir\n");
    execGit(dir, [
      "add",
      ".gitignore",
      ".aiignore",
      ".grape/rules.md",
      "src/app.ts",
      "package-lock.json",
      "pnpm-lock.yaml"
    ]);
    execGit(dir, ["add", "-f", "ignored.env", "private.txt"]);
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

test("snapshot evidence persists allowed source records and privacy-safe rejections", () => {
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

      const sources = evidenceRepositories.sources.listBySnapshot(result.snapshotId);
      const sourceByRef = new Map(sources.map((source) => [source.sourceRef, source]));
      const rejections = evidenceRepositories.sourceRejections.listAll();
      const rejectionByRef = new Map(rejections.map((rejection) => [rejection.sourceRef, rejection]));

      assert.equal(sources.length, result.snapshot.files.length);
      assert.equal(result.evidence.sourcesInserted, sources.length);
      assert.equal(sourceByRef.get("src/app.ts")?.sourceType, "repository_file");
      assert.equal(sourceByRef.get("src/app.ts")?.trustClass, "trusted");
      assert.equal(sourceByRef.get("src/app.ts")?.privacyStatus, "allowed");
      assert.equal(sourceByRef.get("src/app.ts")?.redactionStatus, "not_needed");
      assert.equal(sourceByRef.get("src/app.ts")?.sourceScope, "committed");
      assert.equal(sourceByRef.get("package-lock.json")?.sourceType, "lockfile");
      assert.equal(sourceByRef.get("pnpm-lock.yaml")?.sourceType, "lockfile");
      assert.equal(sourceByRef.get(".grape/rules.md")?.sourceType, "rule_file");
      assert.equal(sourceByRef.has("ignored.env"), false);
      assert.equal(sourceByRef.has("private.txt"), false);
      assert.equal(sourceByRef.has("node_modules/package/index.js"), false);
      assert.equal(rejectionByRef.get("ignored.env")?.rejectionReason, "git_ignored");
      assert.equal(rejectionByRef.get("ignored.env")?.privacyStatus, "ignored");
      assert.equal(rejectionByRef.get("private.txt")?.rejectionReason, "privacy_ignored");
      assert.equal(rejectionByRef.get("private.txt")?.privacyStatus, "private");
      assert.equal(rejectionByRef.has("node_modules/package/index.js"), false);

      const persistedText = JSON.stringify({ sources, rejections });
      assert.equal(persistedText.includes("SECRET=forced-tracked"), false);
      assert.equal(persistedText.includes("SECRET=ignored-dir"), false);
      assert.equal(persistedText.includes("PRIVATE=value"), false);
    });
  });
});

test("snapshot evidence persistence is idempotent for the same repo state", () => {
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

      assert.equal(second.evidence.sourcesInserted, 0);
      assert.equal(second.evidence.sourceRejectionsInserted, 0);
    });
  });
});
