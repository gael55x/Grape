import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  persistGitRepoSnapshot,
  persistSourceProofs,
  readLocalSourceExcerpts
} from "../../../.tmp/build/src/app/index.js";
import { validateExactSourceProof } from "../../../.tmp/build/src/core/proofs/index.js";
import {
  applyStorageMigrations,
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createProofStorageRepositories,
  createStorageRepositories,
  storageMigrationReferences
} from "../../../.tmp/build/src/core/storage/index.js";

const now = "2026-05-26T00:00:00.000Z";

function migrationSources() {
  return storageMigrationReferences.map((migration) => ({
    ...migration,
    sql: readFileSync(path.join(process.cwd(), "src/core/storage/migrations", migration.filename), "utf8")
  }));
}

function withMigratedDatabase(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-source-proof-db-"));
  const database = new DatabaseSync(path.join(dir, "grape.db"));

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    fn({
      database,
      repositories: createStorageRepositories(database),
      evidenceRepositories: createEvidenceStorageRepositories(database),
      indexingRepositories: createIndexingStorageRepositories(database),
      proofRepositories: createProofStorageRepositories(database)
    });
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-source-proof-repo-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, "AGENTS.md"), "Always keep exact evidence for safety rules.\n");
    writeFileSync(path.join(dir, "src", "app.ts"), "export function runApp() { return 'ok'; }\n");
    execGit(dir, ["add", "AGENTS.md", "src/app.ts"]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "initial source proof fixture"
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

test("validated exact source proof rows persist from real snapshot excerpts", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase(({ database, repositories, evidenceRepositories, indexingRepositories, proofRepositories }) => {
      const snapshotResult = persistGitRepoSnapshot({
        database,
        repositories,
        evidenceRepositories,
        indexingRepositories,
        rootPath: repoPath,
        projectId: "project-1",
        repoId: "repo-1",
        now
      });
      const sources = evidenceRepositories.sources.listBySnapshot(snapshotResult.snapshotId);
      const sourceExcerpts = readLocalSourceExcerpts({
        rootPath: repoPath,
        sources,
        preferredSourceRefs: ["src/app.ts", "AGENTS.md"]
      });

      assert.equal(sourceExcerpts.length >= 2, true);

      const first = persistSourceProofs({
        repositories: proofRepositories,
        sources,
        sourceExcerpts,
        now
      });

      assert.equal(first.rejectedProofs.length, 0);
      assert.equal(first.proofsSeen, sourceExcerpts.length);
      assert.equal(first.proofsInserted, sourceExcerpts.length);
      assert.equal(first.acceptedSourceExcerpts.length, sourceExcerpts.length);

      for (const excerpt of sourceExcerpts) {
        const proof = proofRepositories.proofs.get(excerpt.proofId);
        assert.ok(proof);
        assert.equal(
          proofRepositories.proofs
            .listBySource(excerpt.sourceId)
            .some((sourceProof) => sourceProof.proofId === excerpt.proofId),
          true
        );
        assert.equal(proof.claimId, undefined);
        assert.equal(proof.sourceId, excerpt.sourceId);
        assert.equal(proof.proofType, "exact_source_excerpt");
        assert.equal(proof.sourceHash, excerpt.sourceHash);
        assert.equal(proof.excerptHash, excerpt.excerptHash);
        assert.equal(proof.supportStatus, "direct");
        assert.equal(proof.createdAt, now);
      }

      const second = persistSourceProofs({
        repositories: proofRepositories,
        sources,
        sourceExcerpts,
        now: "2026-05-26T00:01:00.000Z"
      });

      assert.equal(second.rejectedProofs.length, 0);
      assert.equal(second.proofsSeen, sourceExcerpts.length);
      assert.equal(second.proofsInserted, 0);
      assert.equal(second.acceptedSourceExcerpts.length, sourceExcerpts.length);
    });
  });
});

test("source proof persistence rejects excerpt hash mismatches", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase(({ database, repositories, evidenceRepositories, indexingRepositories, proofRepositories }) => {
      const snapshotResult = persistGitRepoSnapshot({
        database,
        repositories,
        evidenceRepositories,
        indexingRepositories,
        rootPath: repoPath,
        projectId: "project-1",
        repoId: "repo-1",
        now
      });
      const sources = evidenceRepositories.sources.listBySnapshot(snapshotResult.snapshotId);
      const [excerpt] = readLocalSourceExcerpts({ rootPath: repoPath, sources });
      assert.ok(excerpt);

      const rejected = persistSourceProofs({
        repositories: proofRepositories,
        sources,
        sourceExcerpts: [{ ...excerpt, excerptHash: "0".repeat(64) }],
        now
      });

      assert.equal(rejected.proofsInserted, 0);
      assert.equal(rejected.acceptedSourceExcerpts.length, 0);
      assert.deepEqual(rejected.rejectedProofs, [
        {
          proofId: excerpt.proofId,
          sourceId: excerpt.sourceId,
          reason: "excerpt_hash_mismatch"
        }
      ]);
      assert.equal(proofRepositories.proofs.get(excerpt.proofId), undefined);
    });
  });
});

test("assistant responses cannot become exact source proof rows", () => {
  const excerpt = "The system definitely works.";
  const excerptHash = sha256(excerpt);
  const sourceHash = sha256("assistant text");

  const result = validateExactSourceProof(
    {
      proofId: "proof:assistant",
      sourceId: "source-assistant",
      sourceType: "assistant_response",
      sourceHash,
      excerpt,
      excerptHash
    },
    {
      sourceId: "source-assistant",
      sourceType: "assistant_response",
      sourceHash,
      trustClass: "temporary",
      privacyStatus: "allowed",
      redactionStatus: "not_needed"
    }
  );

  assert.deepEqual(result, {
    accepted: false,
    rejectionReason: "source_not_trusted"
  });
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
