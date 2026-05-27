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
} from "../../.tmp/build/src/core/storage/index.js";

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
