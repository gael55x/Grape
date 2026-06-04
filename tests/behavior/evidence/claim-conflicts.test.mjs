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
