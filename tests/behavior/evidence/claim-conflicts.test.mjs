import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  applyStorageMigrations,
  createClaimStorageRepositories,
  storageMigrationReferences
} from "../../../.tmp/build/src/core/storage/index.js";
import { detectProjectRuleConflicts } from "../../../.tmp/build/src/core/claims/index.js";
import { resolveLocalCurrentValidClaims } from "../../../.tmp/build/src/app/local-project/inspection/claim-resolution.js";

const now = "2026-05-26T00:00:00.000Z";
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

function migrationSources() {
  return storageMigrationReferences.map((migration) => ({
    ...migration,
    sql: readFileSync(path.join(process.cwd(), "src/core/storage/migrations", migration.filename), "utf8")
  }));
}

function withClaimRepositories(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-claim-conflicts-"));
  const database = new DatabaseSync(path.join(dir, "grape.db"));

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    fn(createClaimStorageRepositories(database));
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test("claim edge repository lists conflict relationships without non-conflict edges", () => {
  withClaimRepositories((repositories) => {
    repositories.claims.insertOrIgnore(claim("claim-a", "Runtime uses node:test", hashA));
    repositories.claims.insertOrIgnore(claim("claim-b", "Runtime uses vitest", hashB));

    repositories.claimEdges.insertOrIgnore({
      edgeId: "edge-conflict",
      sourceClaimId: "claim-a",
      targetClaimId: "claim-b",
      edgeType: "contradicts",
      createdAt: now
    });
    repositories.claimEdges.insertOrIgnore({
      edgeId: "edge-related",
      sourceClaimId: "claim-a",
      targetClaimId: "claim-b",
      edgeType: "related_to",
      createdAt: now
    });

    const conflicts = repositories.claimEdges.listConflictEdges();

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].edgeId, "edge-conflict");
    assert.equal(conflicts[0].edgeType, "contradicts");
    assert.equal(repositories.claimEdges.get("edge-related")?.edgeType, "related_to");
  });
});

test("project rule conflict detector creates review edges for opposing overlapping rules", () => {
  const conflicts = detectProjectRuleConflicts([
    {
      claimId: "claim-a",
      claimType: "project_rule",
      claimText: "Project rule from AGENTS.md line 1: Never use console logs in production code"
    },
    {
      claimId: "claim-b",
      claimType: "project_rule",
      claimText: "Project rule from AGENTS.md line 2: Use console logs in production code"
    },
    {
      claimId: "claim-c",
      claimType: "project_rule",
      claimText: "Project rule from AGENTS.md line 3: Prefer focused tests for changed behavior"
    }
  ]);

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].edgeType, "needs_review");
  assert.equal(conflicts[0].sourceClaimId, "claim-a");
  assert.equal(conflicts[0].targetClaimId, "claim-b");
  assert.match(conflicts[0].edgeId, /^edge:[a-f0-9]{24}$/);
});

test("current-valid resolution rejects unresolved contradicted claims", () => {
  const resolved = resolveLocalCurrentValidClaims(currentValidInput({
    edges: [
      edge("edge-conflict", "claim-a", "claim-b", "contradicts", "2026-05-26T00:00:00.000Z")
    ]
  }));

  assert.equal(resolved.activeClaims.length, 0);
  assert.equal(resolved.rejectedCount, 2);
});

test("current-valid resolution allows contradicted claims after conflict resolution", () => {
  const resolved = resolveLocalCurrentValidClaims(currentValidInput({
    edges: [
      edge("edge-conflict", "claim-a", "claim-b", "contradicts", "2026-05-26T00:00:00.000Z"),
      edge("edge-resolution", "claim-a", "claim-b", "coexists_with", "2026-05-26T00:00:01.000Z")
    ]
  }));

  assert.deepEqual(resolved.activeClaims.map((claim) => claim.claimId).sort(), ["claim-a", "claim-b"]);
  assert.equal(resolved.rejectedCount, 0);
});

test("current-valid resolution rejects superseded target claims only", () => {
  const resolved = resolveLocalCurrentValidClaims(currentValidInput({
    edges: [
      edge("edge-supersedes", "claim-a", "claim-b", "supersedes", "2026-05-26T00:00:00.000Z")
    ]
  }));

  assert.deepEqual(resolved.activeClaims.map((claim) => claim.claimId), ["claim-a"]);
  assert.equal(resolved.rejectedCount, 1);
});

test("current-valid resolution rejects claim types disabled by durable policy", () => {
  const resolved = resolveLocalCurrentValidClaims(currentValidInput({
    claimTypeA: "runtime_behavior",
    edges: []
  }));

  assert.deepEqual(resolved.activeClaims.map((claim) => claim.claimId), ["claim-b"]);
  assert.equal(resolved.rejectedCount, 1);
  assert.match(resolved.warnings.join("\n"), /Durable claim policy blocked current-valid claim/);
});

function claim(claimId, claimText, scopeHash) {
  return {
    claimId,
    subject: "test-runtime",
    claimType: "project_fact",
    claimText,
    scopeJson: JSON.stringify({ branch: "main" }),
    scopeHash,
    verificationStatus: "verified",
    createdAt: now,
    updatedAt: now
  };
}

function currentValidInput({
  edges,
  claimTypeA = "repository_source_excerpt_exists",
  claimTypeB = "repository_source_excerpt_exists"
}) {
  const sourceA = source("src/a.ts", hashA);
  const sourceB = source("src/b.ts", hashB);
  const proofA = proof("proof-a", "claim-a", "source-a", hashA);
  const proofB = proof("proof-b", "claim-b", "source-b", hashB);
  const claims = [
    currentClaim("claim-a", "Claim A", sourceA, proofA, claimTypeA),
    currentClaim("claim-b", "Claim B", sourceB, proofB, claimTypeB)
  ];
  const proofsByClaim = new Map([
    ["claim-a", [proofA]],
    ["claim-b", [proofB]]
  ]);
  const sources = new Map([
    ["source-a", sourceA],
    ["source-b", sourceB]
  ]);

  return {
    claims: {
      list: () => claims
    },
    claimEdges: {
      list: () => edges
    },
    proofs: {
      listByClaim: (claimId) => proofsByClaim.get(claimId) ?? []
    },
    sources: {
      get: (sourceId) => sources.get(sourceId)
    },
    snapshot: {
      branch: "main",
      commit: "commit-a",
      worktreeHash: "worktree-a",
      files: [
        { path: sourceA.sourceRef, sha256: sourceA.sourceHash },
        { path: sourceB.sourceRef, sha256: sourceB.sourceHash }
      ]
    }
  };
}

function currentClaim(claimId, claimText, sourceRecord, proofRecord, claimType) {
  return {
    claimId,
    subject: sourceRecord.sourceRef,
    claimType,
    claimText,
    scopeJson: JSON.stringify({
      branch: "main",
      commit: "commit-a",
      sourceRef: sourceRecord.sourceRef,
      sourceHash: sourceRecord.sourceHash,
      excerptHash: proofRecord.excerptHash,
      sourceScope: "committed"
    }),
    scopeHash: sourceRecord.sourceHash,
    verificationStatus: "verified",
    createdAt: now,
    updatedAt: now
  };
}

function source(sourceRef, sourceHash) {
  return {
    sourceId: sourceRef === "src/a.ts" ? "source-a" : "source-b",
    sourceRef,
    sourceType: "repository_file",
    sourceHash,
    trustClass: "trusted",
    privacyStatus: "allowed",
    redactionStatus: "not_needed"
  };
}

function proof(proofId, claimId, sourceId, sourceHash) {
  return {
    proofId,
    claimId,
    sourceId,
    proofType: "exact_source_excerpt",
    sourceHash,
    excerptHash: sourceHash,
    supportStatus: "direct"
  };
}

function edge(edgeId, sourceClaimId, targetClaimId, edgeType, createdAt) {
  return {
    edgeId,
    sourceClaimId,
    targetClaimId,
    edgeType,
    createdAt
  };
}
