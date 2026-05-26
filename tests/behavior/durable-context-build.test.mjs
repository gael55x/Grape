import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { buildDurableContext } from "../../.tmp/build/src/app/index.js";
import {
  applyStorageMigrations,
  createStorageRepositories,
  storageMigrationReferences
} from "../../.tmp/build/src/core/storage/index.js";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const hashC = "c".repeat(64);
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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-durable-build-"));
  const database = new DatabaseSync(path.join(dir, "grape.db"));

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    fn(database, createStorageRepositories(database));
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function insertBaseGraph(repositories, lockToken = "lock-1") {
  repositories.projects.insert({
    projectId: "project-1",
    rootPath: "/repo",
    grapeDirPath: "/repo/.grape",
    createdAt: now,
    updatedAt: now
  });
  repositories.repos.insert({
    repoId: "repo-1",
    projectId: "project-1",
    vcsType: "git",
    rootPath: "/repo",
    normalizedRootPath: "/repo",
    createdAt: now,
    updatedAt: now
  });
  repositories.repoSnapshots.insert({
    snapshotId: "snapshot-1",
    repoId: "repo-1",
    branch: "main",
    commitSha: "abc123",
    worktreeHash: hashA,
    snapshotHash: hashB,
    dirtyState: "clean",
    createdAt: now
  });
  repositories.worktreeStates.insert({
    worktreeStateId: "worktree-1",
    snapshotId: "snapshot-1",
    state: "clean",
    dirtyPathsJson: "[]",
    createdAt: now
  });
  repositories.contextSessions.insert({
    sessionId: "session-1",
    projectId: "project-1",
    repoId: "repo-1",
    repoSnapshotId: "snapshot-1",
    worktreeStateId: "worktree-1",
    agentName: "codex",
    agentSessionId: "agent-session-1",
    taskId: "task-1",
    taskType: "analysis",
    branchName: "main",
    headCommitSha: "abc123",
    status: "active",
    lockStatus: "locked",
    lockToken,
    startedAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now
  });
}

function section(overrides = {}) {
  return {
    id: overrides.id ?? "claim",
    type: overrides.type ?? "active_claim",
    title: overrides.title ?? "Discount claim",
    body: overrides.body ?? "calculateDiscount returns a member discount for positive subtotals.",
    sourceRefs: overrides.sourceRefs ?? ["src/calculateDiscount.ts"],
    proofRefs: overrides.proofRefs ?? ["proof-1"],
    dependencyRefs: overrides.dependencyRefs ?? ["dep-1"],
    contentHash: overrides.contentHash ?? hashA,
    pinned: overrides.pinned ?? false,
    exactRequired: overrides.exactRequired ?? true,
    redactionStatus: "clean"
  };
}

function artifact(artifactId, overrides = {}) {
  const manifestHash = overrides.manifestHash ?? hashB;
  const dependencies = overrides.dependencies ?? [
    {
      id: "dep-1",
      kind: "source_file",
      ref: "src/calculateDiscount.ts",
      hash: hashA,
      scope: { branch: "main" }
    }
  ];

  return {
    artifactId,
    input: {
      taskId: "task-1",
      sessionId: "session-1",
      repoId: "repo-1",
      branch: "main",
      commit: "abc123",
      worktreeHash: hashA,
      taskType: "analysis",
      riskOverlays: [],
      userRequestHash: hashB
    },
    sections: overrides.sections ?? [
      section({
        id: "rule",
        type: "pinned_rule",
        title: "Pinned rule",
        body: "Never omit safety-critical project rules.",
        pinned: true,
        exactRequired: false
      }),
      section({ id: "claim" })
    ],
    dependencyManifest: {
      manifestId: `manifest-${artifactId}`,
      dependencies,
      createdAt: now,
      hashAlgorithm: "sha256",
      manifestHash
    },
    warnings: [],
    unsafeReasons: [],
    createdAt: now,
    artifactHash: overrides.artifactHash ?? hashA
  };
}

function build(database, repositories, artifactInput, turn = 1, overrides = {}) {
  return buildDurableContext({
    database,
    repositories,
    sessionId: "session-1",
    lockToken: "lock-1",
    snapshotId: "snapshot-1",
    artifact: artifactInput,
    fixture: "clean-typescript-app",
    turn,
    now,
    ...overrides
  });
}

test("durable context build persists first turn pack and sent ledger atomically", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories);

    const result = build(database, repositories, artifact("artifact-1"));

    assert.deepEqual(
      result.contextPackItems.map((item) => item.state),
      ["PINNED", "NEW"]
    );
    assert.equal(result.sentItems.length, 2);
    assert.equal(result.omittedItems.length, 0);
    assert.equal(result.unsafeOmissions, 0);
    assert.equal(repositories.contextArtifacts.get("artifact-1")?.dependencyManifestHash, hashB);
    assert.deepEqual(
      repositories.contextSentItems.listBySession("session-1").map((item) => item.lastDiffState).sort(),
      ["PINNED", "NEW"].sort()
    );
    assert.deepEqual(
      repositories.contextPackItems.listBySession("session-1").map((item) => item.diffState).sort(),
      ["PINNED", "NEW"].sort()
    );
  });
});

test("durable context build omits unchanged non-pinned sections on second turn", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories);
    build(database, repositories, artifact("artifact-1"), 1);

    const result = build(database, repositories, artifact("artifact-2"), 2);

    assert.deepEqual(
      result.contextPackItems.map((item) => item.state),
      ["PINNED", "OMIT_UNCHANGED", "RESTORE_AVAILABLE"]
    );
    assert.equal(result.sentItems.length, 1);
    assert.equal(result.omittedItems.length, 1);
    assert.equal(result.omittedItems[0].restoreId?.startsWith("restore:session-1:artifact-2:claim"), true);
    assert.ok(result.tokenMetric.omittedUnchangedTokens > 0);
    assert.deepEqual(
      repositories.omittedContextItems.listBySession("session-1").map((item) => item.lastDiffState),
      ["OMIT_UNCHANGED"]
    );
  });
});

test("durable context build invalidates stale dependency manifests before resending", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories);
    build(database, repositories, artifact("artifact-1"), 1);

    const result = build(database, repositories, artifact("artifact-2", { manifestHash: hashC }), 2);

    assert.ok(result.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"));
    assert.deepEqual(
      result.contextPackItems.slice(-2).map((item) => item.state),
      ["PINNED", "NEW"]
    );
    assert.equal(result.omittedItems.length, 0);
    assert.ok(
      repositories.contextPackItems
        .listBySession("session-1")
        .some((item) => item.diffState === "INVALIDATE_PREVIOUS" && item.invalidatesSentItemId)
    );
  });
});

test("durable context build rejects missing session lock without persisting an artifact", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories, "other-lock");

    assert.throws(
      () => build(database, repositories, artifact("artifact-1")),
      /active session lock/
    );

    assert.equal(repositories.contextArtifacts.get("artifact-1"), undefined);
  });
});

test("durable context build rolls back artifact and ledger writes on failure", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories);

    const badArtifact = artifact("artifact-1", {
      dependencies: [
        {
          id: "dep-1",
          kind: "source_file",
          ref: "src/calculateDiscount.ts",
          hash: hashA,
          scope: { branch: "main" }
        },
        {
          id: "dep-1",
          kind: "source_file",
          ref: "src/calculateDiscount.ts",
          hash: hashA,
          scope: { branch: "main" }
        }
      ]
    });

    assert.throws(() => build(database, repositories, badArtifact), /constraint failed/i);
    assert.equal(repositories.contextArtifacts.get("artifact-1"), undefined);
    assert.deepEqual(repositories.contextSentItems.listBySession("session-1"), []);
    assert.deepEqual(repositories.contextPackItems.listBySession("session-1"), []);
  });
});

test("durable context build rolls back ledger writes when prepared output is blocked", () => {
  withMigratedDatabase((database, repositories) => {
    insertBaseGraph(repositories);

    assert.throws(
      () =>
        build(database, repositories, artifact("artifact-1"), 1, {
          prepareOutput() {
            throw new Error("output blocked");
          }
        }),
      /output blocked/
    );

    assert.equal(repositories.contextArtifacts.get("artifact-1"), undefined);
    assert.deepEqual(repositories.contextSentItems.listBySession("session-1"), []);
    assert.deepEqual(repositories.contextPackItems.listBySession("session-1"), []);
    assert.deepEqual(repositories.omittedContextItems.listBySession("session-1"), []);
  });
});
