import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  persistPackageManifestDependencyClaims,
  persistGitRepoSnapshot,
  persistSymbolDeclarationClaims,
  persistSourceExcerptClaims,
  persistSourceProofs,
  readLocalSourceExcerpts
} from "../../../.tmp/build/src/app/index.js";
import { resolveLocalCurrentValidClaims } from "../../../.tmp/build/src/app/local-project/inspection/claim-resolution.js";
import { createGitRepoSnapshot } from "../../../.tmp/build/src/core/git/index.js";
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
    mkdirSync(path.join(dir, "packages", "web", "src"), { recursive: true });
    writeFileSync(path.join(dir, "src", "app.ts"), "export function runApp() { return 'ok'; }\n");
    writeFileSync(
      path.join(dir, "packages", "api", "package.json"),
      [
        "{",
        "  \"name\": \"api-fixture\",",
        "  \"dependencies\": {",
        "    \"grape-api-client\": \"^1.2.3\"",
        "  },",
        "  \"devDependencies\": {",
        "    \"node:test\": \"^1.0.0\"",
        "  }",
        "}",
        ""
      ].join("\n")
    );
    writeFileSync(
      path.join(dir, "packages", "api", "src", "app.ts"),
      "export function runApiApp() { return 'api'; }\n"
    );
    writeFileSync(
      path.join(dir, "packages", "web", "package.json"),
      [
        "{",
        "  \"name\": \"web-fixture\",",
        "  \"dependencies\": {",
        "    \"grape-web-client\": \"^4.5.6\"",
        "  }",
        "}",
        ""
      ].join("\n")
    );
    writeFileSync(
      path.join(dir, "packages", "web", "src", "app.ts"),
      "export function runWebApp() { return 'web'; }\n"
    );
    execGit(dir, ["add", "src/app.ts", "packages/api", "packages/web"]);
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

test("npm package manifest dependency claims persist with proof-backed package scope", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((ctx) => {
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

      const first = persistPackageManifestDependencyClaims({
        repositories: ctx.claimRepositories,
        proofRepositories: ctx.proofRepositories,
        rootPath: repoPath,
        sources,
        branch: snapshotResult.snapshot.branch,
        commit: snapshotResult.snapshot.commit,
        worktreeHash: snapshotResult.snapshot.worktreeHash,
        now
      });

      assert.deepEqual(first.rejectedCandidates, []);
      assert.equal(first.dependenciesSeen, 3);
      assert.equal(first.proofsInserted, 3);
      assert.equal(first.candidatesInserted, 3);
      assert.equal(first.claimsInserted, 3);

      const claims = ctx.claimRepositories.claims
        .list()
        .filter((claim) => claim.claimType === "package_manifest_dependency_exists");
      assert.equal(claims.length, 3);
      const apiClientClaim = claims.find((claim) => claim.subject.endsWith("#dependencies:grape-api-client"));
      assert.ok(apiClientClaim);
      assert.equal(apiClientClaim.claimText, "Manifest declares dependency grape-api-client.");
      assert.equal(apiClientClaim.verificationStatus, "verified");

      const scope = JSON.parse(apiClientClaim.scopeJson);
      assert.equal(scope.sourceRef, "packages/api/package.json");
      assert.equal(scope.manifestRef, "packages/api/package.json");
      assert.equal(scope.manifestKind, "npm_package");
      assert.equal(scope.packageRoot, "packages/api");
      assert.equal(scope.packageRootRef, "packages/api");
      assert.equal(scope.dependencyName, "grape-api-client");
      assert.equal(scope.dependencySection, "dependencies");
      assert.equal(scope.providerId, "generic_manifest");
      assert.deepEqual(scope.providerCapabilities, ["package_roots"]);
      assert.equal(typeof scope.dependencySpecifierHash, "string");
      assert.equal(scope.dependencySpecifierHash.length, 64);
      assert.equal(typeof scope.excerptHash, "string");
      assert.equal(scope.excerptHash.length, 64);
      assert.equal(Number.isInteger(scope.startLine), true);
      assert.equal(Number.isInteger(scope.endLine), true);

      const [proof] = ctx.proofRepositories.proofs.listByClaim(apiClientClaim.claimId);
      assert.ok(proof);
      assert.equal(proof.claimId, apiClientClaim.claimId);
      assert.equal(proof.sourceId, scope.sourceId);
      assert.equal(proof.proofType, "package_manifest_dependency_entry");
      assert.equal(proof.sourceHash, scope.sourceHash);
      assert.equal(proof.excerptHash, scope.excerptHash);
      assert.equal(proof.supportStatus, "direct");

      const publicRows = JSON.stringify({ claims, proof });
      assert.equal(publicRows.includes("^1.2.3"), false);
      assert.equal(publicRows.includes("\"grape-api-client\": \"^1.2.3\""), false);
      assert.equal(publicRows.includes(repoPath), false);

      const second = persistPackageManifestDependencyClaims({
        repositories: ctx.claimRepositories,
        proofRepositories: ctx.proofRepositories,
        rootPath: repoPath,
        sources,
        branch: snapshotResult.snapshot.branch,
        commit: snapshotResult.snapshot.commit,
        worktreeHash: snapshotResult.snapshot.worktreeHash,
        now
      });

      assert.equal(second.proofsInserted, 0);
      assert.equal(second.candidatesInserted, 0);
      assert.equal(second.claimsInserted, 0);
    });
  });
});

test("package manifest dependency claims require current manifest hash and matching package root", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((ctx) => {
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
      persistPackageManifestDependencyClaims({
        repositories: ctx.claimRepositories,
        proofRepositories: ctx.proofRepositories,
        rootPath: repoPath,
        sources,
        branch: snapshotResult.snapshot.branch,
        commit: snapshotResult.snapshot.commit,
        worktreeHash: snapshotResult.snapshot.worktreeHash,
        now
      });

      const apiActive = resolveLocalCurrentValidClaims({
        claims: ctx.claimRepositories.claims,
        claimEdges: ctx.claimRepositories.claimEdges,
        proofs: ctx.proofRepositories.proofs,
        sources: ctx.evidenceRepositories.sources,
        snapshot: snapshotResult.snapshot,
        packageRoot: "packages/api"
      });
      const apiDependencyClaims = apiActive.activeClaims.filter(
        (claim) => claim.claimType === "package_manifest_dependency_exists"
      );
      assert.deepEqual(
        apiDependencyClaims.map((claim) => claim.subject).sort(),
        [
          "packages/api/package.json#dependencies:grape-api-client",
          "packages/api/package.json#devDependencies:node:test"
        ]
      );
      const apiClientActiveClaim = apiDependencyClaims.find(
        (claim) => claim.subject === "packages/api/package.json#dependencies:grape-api-client"
      );
      const apiDevActiveClaim = apiDependencyClaims.find(
        (claim) => claim.subject === "packages/api/package.json#devDependencies:node:test"
      );
      assert.ok(apiClientActiveClaim);
      assert.ok(apiDevActiveClaim);
      ctx.claimRepositories.claimEdges.insertOrIgnore({
        edgeId: "edge-manifest-dependency-conflict",
        sourceClaimId: apiClientActiveClaim.claimId,
        targetClaimId: apiDevActiveClaim.claimId,
        edgeType: "contradicts",
        authority: {
          createdBy: "user_confirmation",
          confidence: 1,
          reason: "fixture conflict",
          metadataJson: "{}",
          createdAt: now
        },
        createdAt: now
      });
      const conflictedApi = resolveLocalCurrentValidClaims({
        claims: ctx.claimRepositories.claims,
        claimEdges: ctx.claimRepositories.claimEdges,
        proofs: ctx.proofRepositories.proofs,
        sources: ctx.evidenceRepositories.sources,
        snapshot: snapshotResult.snapshot,
        packageRoot: "packages/api"
      });
      assert.equal(
        conflictedApi.activeClaims.some((claim) => claim.claimType === "package_manifest_dependency_exists"),
        false
      );

      const webScoped = resolveLocalCurrentValidClaims({
        claims: ctx.claimRepositories.claims,
        claimEdges: ctx.claimRepositories.claimEdges,
        proofs: ctx.proofRepositories.proofs,
        sources: ctx.evidenceRepositories.sources,
        snapshot: snapshotResult.snapshot,
        packageRoot: "packages/web"
      });
      assert.equal(
        webScoped.activeClaims.some((claim) => claim.subject === "packages/api/package.json#dependencies:grape-api-client"),
        false
      );

      writeFileSync(
        path.join(repoPath, "packages", "api", "package.json"),
        [
          "{",
          "  \"name\": \"api-fixture\",",
          "  \"dependencies\": {",
          "    \"grape-api-client\": \"^9.9.9\"",
          "  }",
          "}",
          ""
        ].join("\n")
      );
      const changedSnapshot = createGitRepoSnapshot({ rootPath: repoPath, createdAt: now });
      const stale = resolveLocalCurrentValidClaims({
        claims: ctx.claimRepositories.claims,
        claimEdges: ctx.claimRepositories.claimEdges,
        proofs: ctx.proofRepositories.proofs,
        sources: ctx.evidenceRepositories.sources,
        snapshot: changedSnapshot,
        packageRoot: "packages/api"
      });

      assert.equal(
        stale.activeClaims.some((claim) => claim.subject === "packages/api/package.json#dependencies:grape-api-client"),
        false
      );
      assert.equal(stale.rejectedCount > 0, true);
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
