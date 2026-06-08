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
  persistObservedRunResultClaim,
  persistObservedTestFailureRelations
} from "../../../.tmp/build/src/app/index.js";
import { evaluateDurableClaimPolicy } from "../../../.tmp/build/src/core/claims/index.js";
import { buildGrapeTestObservationSource } from "../../../.tmp/build/src/core/evidence/index.js";
import { buildObservedTestFailureRelation } from "../../../.tmp/build/src/app/index.js";
import {
  extractObservedRunProofMaterial,
  extractTestFailureLocations
} from "../../../.tmp/build/src/core/proofs/index.js";
import {
  applyStorageMigrations,
  createClaimStorageRepositories,
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createProofStorageRepositories,
  createStorageRepositories,
  storageMigrationReferences
} from "../../../.tmp/build/src/core/storage/index.js";

const now = "2026-06-08T00:00:00.000Z";

function migrationSources() {
  return storageMigrationReferences.map((migration) => ({
    ...migration,
    sql: readFileSync(path.join(process.cwd(), "src/core/storage/migrations", migration.filename), "utf8")
  }));
}

function withMigratedDatabase(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-failure-relation-db-"));
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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-failure-relation-repo-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    mkdirFixtures(dir);
    execGit(dir, ["add", "."]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "failure relation fixture"
    ]);
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function mkdirFixtures(repoPath) {
  mkdirSync(path.join(repoPath, "src"), { recursive: true });
  mkdirSync(path.join(repoPath, "tests"), { recursive: true });
  writeFileSync(path.join(repoPath, "README.md"), "# Fixture\n");
  writeFileSync(
    path.join(repoPath, "src", "counter.js"),
    "export function increment(value) {\n  return value;\n}\n"
  );
  writeFileSync(
    path.join(repoPath, "tests", "counter.test.js"),
    [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "import { increment } from '../src/counter.js';",
      "test('increments', () => {",
      "  assert.equal(increment(1), 2);",
      "});"
    ].join("\n")
  );
}

function execGit(repoPath, args) {
  return execFileSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

test("extractTestFailureLocations normalizes repo-relative stack lines without raw logs", () => {
  const output = [
    "✖ increments",
    "  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:",
    "  at TestContext.<anonymous> (tests/counter.test.js:5:10)",
    "  at async Test.run (node:internal/test_runner/test:1054:7)"
  ].join("\n");

  const locations = extractTestFailureLocations(output, (candidate) =>
    candidate.replace(/^\.\//, "")
  );

  assert.equal(locations.length, 1);
  assert.equal(locations[0].sourceRef, "tests/counter.test.js");
  assert.equal(locations[0].line, 5);
});

test("observed_test_failure_span_link policy rejects root-cause overclaim meanings", () => {
  const policyInput = {
    claimType: "observed_test_failure_span_link",
    claimMeaning: "observed_failure_span_link",
    proofType: "observed_test_failure_relation",
    sourceType: "test_run",
    supportStatus: "direct",
    sourceTrustClass: "trusted",
    sourcePrivacyStatus: "allowed",
    sourceRedactionStatus: "redacted",
    observer: "grape",
    proofSignalKind: "observed_run"
  };
  const allowed = evaluateDurableClaimPolicy(policyInput);
  assert.equal(allowed.accepted, true);

  const rootCause = evaluateDurableClaimPolicy({
    ...policyInput,
    claimMeaning: "root_cause"
  });
  assert.equal(rootCause.accepted, false);
  assert.equal(rootCause.reason, "claim_meaning_not_allowed");
});

test("failed Grape-observed test runs promote candidate span link claims with hash-only failure output", () => {
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
      const observation = buildFailedTestObservation(repoPath, snapshotResult);
      ctx.evidenceRepositories.sources.insertOrIgnore(observation.source);

      const runPromotion = persistObservedRunResultClaim({
        repositories: ctx.claimRepositories,
        proofRepositories: ctx.proofRepositories,
        source: observation.source,
        now
      });
      assert.equal(runPromotion.claimsInserted, 1);

      const material = extractObservedRunProofMaterial(observation.source);
      assert.equal(material.accepted, true);

      const relationPromotion = persistObservedTestFailureRelations({
        repositories: ctx.claimRepositories,
        proofRepositories: ctx.proofRepositories,
        evidenceRepositories: ctx.evidenceRepositories,
        indexingRepositories: ctx.indexingRepositories,
        rootPath: repoPath,
        source: observation.source,
        material: material.material,
        observedRunClaimId: runPromotion.claimId,
        observedRunProofId: runPromotion.proofId,
        failureOutputText: observation.failureOutputText,
        now
      });

      assert.equal(relationPromotion.claimsInserted, 1);
      assert.match(relationPromotion.claimId, /^claim:[a-f0-9]{24}$/);
      assert.ok(relationPromotion.spanProofsInserted >= 1);

      const claim = ctx.claimRepositories.claims.get(relationPromotion.claimId);
      assert.ok(claim);
      assert.equal(claim.claimType, "observed_test_failure_span_link");
      assert.match(claim.claimText, /observed failing/i);
      assert.match(claim.claimText, /candidate source\/test spans/i);
      assert.match(claim.claimText, /does not prove root cause/i);
      assert.doesNotMatch(claim.claimText, /caused the failure/i);
      assert.doesNotMatch(claim.claimText, /proven fix/i);

      const scope = JSON.parse(claim.scopeJson);
      assert.equal(scope.failureOutput.stdoutHash, observation.stdoutHash);
      assert.equal(scope.failureOutput.stderrHash, observation.stderrHash);
      assert.equal("stdout" in scope.failureOutput, false);
      assert.equal("stderr" in scope.failureOutput, false);
      assert.ok(Array.isArray(scope.candidateLinks));
      assert.ok(scope.candidateLinks[0].testSpan);
      assert.ok(scope.candidateLinks[0].candidateSourceSpan);
      assert.ok(scope.candidateLinks[0].filenameConventionEvidence);
      assert.ok(Array.isArray(scope.candidateLinks[0].missingEvidenceWarnings));
      if (!scope.candidateLinks[0].importEvidence) {
        assert.ok(scope.candidateLinks[0].missingEvidenceWarnings.includes("missing_import_evidence"));
      }

      const proof = ctx.proofRepositories.proofs.get(relationPromotion.proofId);
      assert.equal(proof.proofType, "observed_test_failure_relation");
      assert.equal(proof.excerptHash, scope.relationHash);
      assert.equal("excerpt" in proof, false);
    });
  });
});

test("buildObservedTestFailureRelation stays conservative when no test refs are available", () => {
  const built = buildObservedTestFailureRelation({
    material: {
      sourceId: "source:test",
      sourceType: "test_run",
      sourceRef: "test_run:abc",
      sourceHash: "hash",
      sourceScope: "committed",
      metadata: {
        branch: "main",
        commit: "abc",
        projectId: "p",
        repoId: "r",
        snapshotId: "snap",
        sessionId: "session",
        worktreeHash: "wt",
        observedRunId: "run:1",
        observedBy: "grape",
        observedByGrape: true,
        commandHash: "cmd",
        cwd: ".",
        exitCode: 1,
        stdoutHash: "out",
        stderrHash: "err",
        startedAt: now,
        endedAt: now,
        evidenceHash: "ev",
        redactedFields: [],
        passed: false
      },
      resultHash: "result"
    },
    observedRunClaimId: "claim:run",
    observedRunProofId: "proof:run",
    failureOutputText: "",
    sources: [],
    symbolNodes: [],
    symbolEdges: [],
    manifestPackageRoots: [],
    normalizePath: (candidate) => candidate,
    readSpanExcerpt: () => undefined
  });

  assert.equal(built.accepted, false);
  assert.equal(built.rejectionReason, "no_candidate_links");
});

function buildFailedTestObservation(repoPath, snapshotResult) {
  const commandHash = sha256("node --test tests/counter.test.js");
  const failureOutputText = [
    "✖ increments",
    "  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:",
    "  at TestContext.<anonymous> (tests/counter.test.js:5:10)"
  ].join("\n");
  const stdoutHash = sha256(failureOutputText);
  const stderrHash = sha256("");
  const observation = buildGrapeTestObservationSource({
    projectId: "project-1",
    repoId: "repo-1",
    snapshotId: snapshotResult.snapshotId,
    sessionId: "session-1",
    branch: snapshotResult.snapshot.branch,
    commit: snapshotResult.snapshot.commit,
    worktreeHash: snapshotResult.snapshot.worktreeHash,
    commandHash,
    cwd: ".",
    exitCode: 1,
    stdoutHash,
    stderrHash,
    startedAt: now,
    endedAt: now,
    recordedAt: now,
    observedRunId: "run:abcdef1234567890abcdef12",
    passed: false,
    testFramework: "node",
    testFiles: ["tests/counter.test.js"]
  });

  return {
    ...observation,
    failureOutputText,
    stdoutHash,
    stderrHash
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
