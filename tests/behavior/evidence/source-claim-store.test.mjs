import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  persistGitRepoSnapshot,
  persistSymbolDeclarationClaims,
  persistSourceExcerptClaims,
  persistSourceProofs,
  readLocalSourceExcerpts
} from "../../../.tmp/build/src/app/index.js";
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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-source-claim-db-"));
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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-source-claim-repo-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    mkdirSync(path.join(dir, "src"), { recursive: true });
    mkdirSync(path.join(dir, "packages", "api", "src"), { recursive: true });
    writeFileSync(path.join(dir, "src", "app.ts"), "export function runApp() { return 'ok'; }\n");
    writeFileSync(
      path.join(dir, "packages", "api", "src", "app.ts"),
      "export function runApiApp() { return 'api'; }\n"
    );
    execGit(dir, ["add", "src/app.ts", "packages/api/src/app.ts"]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "initial source claim fixture"
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

test("validated source proofs promote narrow source excerpt claims", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((ctx) => {
      const fixture = prepareClaimFixture(repoPath, ctx);
      persistSourceProofs({
        repositories: ctx.proofRepositories,
        sources: fixture.sources,
        sourceExcerpts: fixture.sourceExcerpts,
        now
      });

      const first = persistSourceExcerptClaims({
        repositories: ctx.claimRepositories,
        proofRepositories: ctx.proofRepositories,
        sources: fixture.sources,
        sourceExcerpts: fixture.sourceExcerpts,
        branch: fixture.snapshotResult.snapshot.branch,
        commit: fixture.snapshotResult.snapshot.commit,
        worktreeHash: fixture.snapshotResult.snapshot.worktreeHash,
        now
      });

      assert.equal(first.rejectedCandidates.length, 0);
      assert.equal(first.candidatesSeen, fixture.sourceExcerpts.length);
      assert.equal(first.candidatesInserted, fixture.sourceExcerpts.length);
      assert.equal(first.claimsInserted, fixture.sourceExcerpts.length);
      const claims = ctx.claimRepositories.claims.list();
      assert.equal(claims.length, fixture.sourceExcerpts.length);
      assert.equal(claims[0].claimType, "repository_source_excerpt_exists");
      assert.equal(claims[0].verificationStatus, "verified");
      assert.match(claims[0].claimText, /contains the selected exact excerpt/);
      const scope = JSON.parse(claims[0].scopeJson);
      assert.equal(scope.packageRoot, undefined);
      const proof = ctx.proofRepositories.proofs.listByClaim(claims[0].claimId)[0];
      assert.ok(proof);
      assert.equal(proof.claimId, claims[0].claimId);

      const second = persistSourceExcerptClaims({
        repositories: ctx.claimRepositories,
        proofRepositories: ctx.proofRepositories,
        sources: fixture.sources,
        sourceExcerpts: fixture.sourceExcerpts,
        branch: fixture.snapshotResult.snapshot.branch,
        commit: fixture.snapshotResult.snapshot.commit,
        worktreeHash: fixture.snapshotResult.snapshot.worktreeHash,
        now
      });
      assert.equal(second.candidatesInserted, 0);
      assert.equal(second.claimsInserted, 0);
    });
  });
});

test("validated package-local source claims record package root scope", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((ctx) => {
      const fixture = prepareClaimFixture(repoPath, ctx, ["packages/api/src/app.ts"]);
      persistSourceProofs({
        repositories: ctx.proofRepositories,
        sources: fixture.sources,
        sourceExcerpts: fixture.sourceExcerpts,
        now
      });

      const result = persistSourceExcerptClaims({
        repositories: ctx.claimRepositories,
        proofRepositories: ctx.proofRepositories,
        sources: fixture.sources,
        sourceExcerpts: fixture.sourceExcerpts,
        branch: fixture.snapshotResult.snapshot.branch,
        commit: fixture.snapshotResult.snapshot.commit,
        worktreeHash: fixture.snapshotResult.snapshot.worktreeHash,
        now
      });

      assert.deepEqual(result.rejectedCandidates, []);
      assert.equal(result.claimsInserted, 1);
      const [claim] = ctx.claimRepositories.claims.list();
      const scope = JSON.parse(claim.scopeJson);
      assert.equal(scope.sourceRef, "packages/api/src/app.ts");
      assert.equal(scope.packageRoot, "packages/api");
    });
  });
});

test("validated symbol declaration claims record provider proof without raw body", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((ctx) => {
      const fixture = prepareClaimFixture(repoPath, ctx);
      persistSourceProofs({
        repositories: ctx.proofRepositories,
        sources: fixture.sources,
        sourceExcerpts: fixture.sourceExcerpts,
        now
      });

      const result = persistSymbolDeclarationClaims({
        repositories: ctx.claimRepositories,
        proofRepositories: ctx.proofRepositories,
        sources: fixture.sources,
        symbolNodes: ctx.indexingRepositories.symbolNodes.listBySnapshot(fixture.snapshotResult.snapshotId),
        sourceExcerpts: fixture.sourceExcerpts,
        branch: fixture.snapshotResult.snapshot.branch,
        commit: fixture.snapshotResult.snapshot.commit,
        worktreeHash: fixture.snapshotResult.snapshot.worktreeHash,
        now
      });

      assert.deepEqual(result.rejectedCandidates, []);
      assert.equal(result.symbolsSeen, 1);
      assert.equal(result.claimsInserted, 1);
      const [claim] = ctx.claimRepositories.claims.list();
      assert.equal(claim.claimType, "repository_symbol_declaration_exists");
      assert.equal(claim.verificationStatus, "verified");
      assert.match(claim.claimText, /runApp/);
      const scope = JSON.parse(claim.scopeJson);
      assert.equal(scope.symbolName, "runApp");
      assert.equal(scope.symbolKind, "function");
      assert.equal(scope.sourceRef, "src/app.ts");
      assert.equal(typeof scope.bodyHash, "string");
      const [proof] = ctx.proofRepositories.proofs.listByClaim(claim.claimId);
      assert.ok(proof);
      assert.equal(proof.proofType, "provider_symbol_declaration");
      assert.equal(proof.excerptHash, scope.bodyHash);
      assert.equal("excerpt" in proof, false);
      assert.equal("body" in proof, false);
      assert.equal(JSON.stringify({ claim, proof }).includes("return 'ok'"), false);
    });
  });
});

test("source excerpt claim candidates are rejected without validated proofs", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((ctx) => {
      const fixture = prepareClaimFixture(repoPath, ctx);
      const result = persistSourceExcerptClaims({
        repositories: ctx.claimRepositories,
        proofRepositories: ctx.proofRepositories,
        sources: fixture.sources,
        sourceExcerpts: fixture.sourceExcerpts,
        branch: fixture.snapshotResult.snapshot.branch,
        commit: fixture.snapshotResult.snapshot.commit,
        worktreeHash: fixture.snapshotResult.snapshot.worktreeHash,
        now
      });

      assert.equal(result.claimsInserted, 0);
      assert.equal(result.rejectedCandidates.length, fixture.sourceExcerpts.length);
      assert.equal(result.rejectedCandidates[0].reason, "proof_missing");
      const candidates = ctx.claimRepositories.claimCandidates.list();
      assert.equal(candidates[0].rejectionReason, "proof_missing");
      assert.equal(ctx.claimRepositories.claims.list().length, 0);
    });
  });
});

function prepareClaimFixture(repoPath, ctx, preferredSourceRefs = ["src/app.ts"]) {
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
  const sources = ctx.evidenceRepositories.sources.listBySnapshot(snapshotResult.snapshotId);
  const sourceExcerpts = readLocalSourceExcerpts({
    rootPath: repoPath,
    sources,
    preferredSourceRefs
  });

  assert.equal(sourceExcerpts.length, 1);
  return { snapshotResult, sources, sourceExcerpts };
}
