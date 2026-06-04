import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  persistGitRepoSnapshot,
  persistObservedRunResultClaim
} from "../../../.tmp/build/src/app/index.js";
import {
  buildGrapeCommandObservationSource,
  hashStableParts
} from "../../../.tmp/build/src/core/evidence/index.js";
import {
  applyStorageMigrations,
  createClaimStorageRepositories,
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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-observed-run-claim-db-"));
  const database = new DatabaseSync(path.join(dir, "grape.db"));

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    fn({
      database,
      repositories: createStorageRepositories(database),
      evidenceRepositories: createEvidenceStorageRepositories(database),
      indexingRepositories: createIndexingStorageRepositories(database),
      proofRepositories: createProofStorageRepositories(database),
      claimRepositories: createClaimStorageRepositories(database)
    });
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-observed-run-claim-repo-"));

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
      "initial observed run claim fixture"
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

test("Grape-observed command sources promote observed run result proofs and claims", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((ctx) => {
      const fixture = prepareObservedRunFixture(repoPath, ctx);
      ctx.evidenceRepositories.sources.insertOrIgnore(fixture.observation.source);

      const result = persistObservedRunResultClaim({
        repositories: ctx.claimRepositories,
        proofRepositories: ctx.proofRepositories,
        source: fixture.observation.source,
        now
      });

      assert.equal(result.rejectedProofs.length, 0);
      assert.equal(result.rejectedCandidates.length, 0);
      assert.equal(result.proofsInserted, 1);
      assert.equal(result.candidatesInserted, 1);
      assert.equal(result.claimsInserted, 1);
      assert.match(result.proofId, /^proof:[a-f0-9]{24}$/);
      assert.match(result.claimId, /^claim:[a-f0-9]{24}$/);
      assert.equal(result.claimType, "grape_observed_run_result");

      const proof = ctx.proofRepositories.proofs.get(result.proofId);
      assert.ok(proof);
      assert.equal(proof.claimId, result.claimId);
      assert.equal(proof.sourceId, fixture.observation.source.sourceId);
      assert.equal(proof.proofType, "grape_observed_run_result");
      assert.equal(proof.supportStatus, "direct");

      const claim = ctx.claimRepositories.claims.get(result.claimId);
      assert.ok(claim);
      assert.equal(claim.claimType, "grape_observed_run_result");
      assert.equal(claim.verificationStatus, "verified");
      assert.match(claim.claimText, /Grape observed command run/);
      const scope = JSON.parse(claim.scopeJson);
      assert.equal(scope.observedRunId, fixture.observedRunId);
      assert.equal(scope.commandHash, fixture.commandHash);
      assert.equal(scope.sourceHash, fixture.observation.source.sourceHash);
      assert.equal(scope.resultHash, proof.excerptHash);
    });
  });
});

test("observed run promotion rejects source metadata containing raw command output fields", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((ctx) => {
      const fixture = prepareObservedRunFixture(repoPath, ctx);
      const metadata = JSON.parse(fixture.observation.source.metadataJson);
      const source = {
        ...fixture.observation.source,
        sourceId: `${fixture.observation.source.sourceId}:raw`,
        metadataJson: JSON.stringify({
          ...metadata,
          command: "npm test"
        })
      };

      const result = persistObservedRunResultClaim({
        repositories: ctx.claimRepositories,
        proofRepositories: ctx.proofRepositories,
        source,
        now
      });

      assert.equal(result.proofsInserted, 0);
      assert.equal(result.claimsInserted, 0);
      assert.equal(result.rejectedProofs.length, 1);
      assert.equal(result.rejectedProofs[0].reason, "raw_field_present");
      assert.equal(ctx.claimRepositories.claims.list().length, 0);
    });
  });
});

function prepareObservedRunFixture(repoPath, ctx) {
  const snapshotResult = persistGitRepoSnapshot({
    database: ctx.database,
    repositories: ctx.repositories,
    evidenceRepositories: ctx.evidenceRepositories,
    indexingRepositories: ctx.indexingRepositories,
    rootPath: repoPath,
    projectId: "project-1",
    repoId: "repo-1",
    now
  });
  const commandHash = sha256("npm test");
  const stdoutHash = sha256("ok");
  const stderrHash = sha256("");
  const observedRunId = `run:${hashStableParts([
    repoPath,
    "session-1",
    commandHash,
    stdoutHash,
    stderrHash
  ]).slice(0, 24)}`;
  const observation = buildGrapeCommandObservationSource({
    projectId: "project-1",
    repoId: "repo-1",
    snapshotId: snapshotResult.snapshotId,
    sessionId: "session-1",
    branch: snapshotResult.snapshot.branch,
    commit: snapshotResult.snapshot.commit,
    worktreeHash: snapshotResult.snapshot.worktreeHash,
    commandHash,
    cwd: ".",
    exitCode: 0,
    stdoutHash,
    stderrHash,
    startedAt: "2026-05-26T00:00:00.000Z",
    endedAt: "2026-05-26T00:00:01.000Z",
    recordedAt: now,
    observedRunId
  });

  return { snapshotResult, observation, observedRunId, commandHash };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
