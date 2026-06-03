import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  buildContextPackSummaryCompressionArtifact,
  buildRuleDigestCompressionArtifact,
  buildSymbolOutlineCompressionArtifact
} from "../../.tmp/build/src/core/compression/index.js";
import { listContextPackSummarySentItems } from "../../.tmp/build/src/app/local-project/context/context-pack-summary.js";
import {
  applyStorageMigrations,
  createCompressionStorageRepositories,
  createStorageRepositories,
  storageMigrationReferences
} from "../../.tmp/build/src/core/storage/index.js";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const now = "2026-05-26T00:00:00.000Z";

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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-compression-"));
  const database = new DatabaseSync(path.join(dir, "grape.db"));

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    const repositories = createStorageRepositories(database);
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
    fn(createCompressionStorageRepositories(database));
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function symbolOutlineInput(overrides = {}) {
  return {
    projectId: "project-1",
    repoId: "repo-1",
    snapshotId: "snapshot-1",
    worktreeStateId: "worktree-1",
    branch: "main",
    commit: "abc123",
    worktreeHash: hashA,
    symbolNodes: [
      {
        symbolId: "symbol:module",
        path: "src/app.ts",
        name: "src/app.ts",
        symbolKind: "module",
        confidence: "high",
        bodyHash: hashA
      }
    ],
    symbolEdges: [
      {
        edgeId: "symbol_edge:imports",
        edgeType: "imports",
        fromSymbolId: "symbol:module",
        toRef: "src/lib.ts"
      }
    ],
    createdAt: now,
    ...overrides
  };
}

function ruleDigestInput(overrides = {}) {
  return {
    projectId: "project-1",
    repoId: "repo-1",
    snapshotId: "snapshot-1",
    worktreeStateId: "worktree-1",
    branch: "main",
    commit: "abc123",
    worktreeHash: hashA,
    rules: [
      {
        proofId: "proof:rule:agents",
        sourceRef: "AGENTS.md",
        sourceHash: hashA,
        excerptHash: hashB,
        startLine: 1,
        endLine: 12,
        truncated: false
      }
    ],
    createdAt: now,
    ...overrides
  };
}

function contextPackSummaryInput(overrides = {}) {
  return {
    projectId: "project-1",
    repoId: "repo-1",
    snapshotId: "snapshot-1",
    worktreeStateId: "worktree-1",
    sessionId: "session-1",
    branch: "main",
    commit: "abc123",
    worktreeHash: hashA,
    sentItems: [
      {
        sentItemId: "sent:task",
        artifactId: "artifact-1",
        sectionId: "task",
        itemKind: "context_summary",
        itemRef: "task",
        itemHash: hashA,
        contentHash: hashA,
        diffState: "NEW",
        wasPinned: false,
        firstSentAt: now,
        lastSentAt: now,
        sendCount: 1,
        tokenCount: 12
      }
    ],
    createdAt: now,
    ...overrides
  };
}

function sentItem(overrides = {}) {
  return {
    sentItemId: "sent:task",
    sessionId: "session-1",
    artifactId: "artifact-1",
    sectionId: "task",
    taskId: "task-1",
    itemKind: "context_summary",
    itemRef: "task",
    itemHash: hashA,
    contentHash: hashA,
    branchName: "main",
    commitSha: "abc123",
    dependencyManifestHash: hashA,
    wasPinned: false,
    lastDiffState: "NEW",
    firstSentAt: now,
    lastSentAt: now,
    sendCount: 1,
    tokenCount: 12,
    ...overrides
  };
}

test("deterministic symbol outline compression artifacts track input hashes", () => {
  const first = buildSymbolOutlineCompressionArtifact(symbolOutlineInput());
  const second = buildSymbolOutlineCompressionArtifact(symbolOutlineInput());
  const changed = buildSymbolOutlineCompressionArtifact(
    symbolOutlineInput({
      symbolEdges: [
        {
          edgeId: "symbol_edge:imports",
          edgeType: "imports",
          fromSymbolId: "symbol:module",
          toRef: "src/changed.ts"
        }
      ]
    })
  );

  assert.ok(first);
  assert.ok(second);
  assert.ok(changed);
  assert.equal(first.compressionId, second.compressionId);
  assert.equal(first.outputHash, second.outputHash);
  assert.notEqual(first.outputHash, changed.outputHash);
  assert.equal(first.type, "symbol_outline");
  assert.equal(first.method, "deterministic");
  assert.equal(first.inputHashes.length, 2);
  assert.match(first.summaryText, /Indexed symbol nodes: 1/);
});

test("rule_digest_tracks_active_rule_hashes", () => {
  const first = buildRuleDigestCompressionArtifact(ruleDigestInput());
  const second = buildRuleDigestCompressionArtifact(ruleDigestInput());
  const changed = buildRuleDigestCompressionArtifact(
    ruleDigestInput({
      rules: [
        {
          proofId: "proof:rule:agents",
          sourceRef: "AGENTS.md",
          sourceHash: "c".repeat(64),
          excerptHash: "d".repeat(64),
          startLine: 1,
          endLine: 12,
          truncated: false
        }
      ]
    })
  );

  assert.ok(first);
  assert.ok(second);
  assert.ok(changed);
  assert.equal(first.compressionId, second.compressionId);
  assert.equal(first.outputHash, second.outputHash);
  assert.notEqual(first.outputHash, changed.outputHash);
  assert.equal(first.type, "rule_digest");
  assert.equal(first.method, "deterministic");
  assert.equal(first.inputRefs[0]?.kind, "rule");
  assert.equal(first.inputHashes.length, 1);
  assert.match(first.summaryText, /Active rule files: 1/);
  assert.match(first.summaryText, /AGENTS\.md lines 1-12/);
});

test("context_pack_summary_is_deterministic", () => {
  const first = buildContextPackSummaryCompressionArtifact(contextPackSummaryInput());
  const second = buildContextPackSummaryCompressionArtifact(contextPackSummaryInput());
  const changed = buildContextPackSummaryCompressionArtifact(
    contextPackSummaryInput({
      sentItems: [
        {
          sentItemId: "sent:task",
          artifactId: "artifact-1",
          sectionId: "task",
          itemKind: "context_summary",
          itemRef: "task",
          itemHash: hashB,
          contentHash: hashB,
          diffState: "CHANGED",
          wasPinned: false,
          firstSentAt: now,
          lastSentAt: now,
          sendCount: 2,
          tokenCount: 12
        }
      ]
    })
  );

  assert.ok(first);
  assert.ok(second);
  assert.ok(changed);
  assert.equal(first.compressionId, second.compressionId);
  assert.equal(first.outputHash, second.outputHash);
  assert.notEqual(first.outputHash, changed.outputHash);
  assert.equal(first.type, "context_pack_summary");
  assert.equal(first.method, "deterministic");
  assert.equal(first.inputRefs[0]?.kind, "context_artifact");
  assert.equal(first.inputHashes.length, 1);
  assert.match(first.summaryText, /Prior sent items: 1/);
  assert.match(first.summaryText, /sent:task NEW context_summary:task/);
});

test("context pack summary inputs exclude invalidated and compression sent items", () => {
  const inputs = listContextPackSummarySentItems({
    repositories: {
      contextSentItems: {
        listBySessionScope({ branchName, commitSha, excludedKind }) {
          return [
            sentItem(),
            sentItem({
              sentItemId: "sent:task:old",
              sectionId: "task",
              lastSentAt: "2026-05-25T00:00:00.000Z"
            }),
            sentItem({
              sentItemId: "sent:compression",
              sectionId: "compression-orientation",
              itemKind: "compression_artifact"
            }),
            sentItem({
              sentItemId: "sent:stale",
              sectionId: "stale"
            }),
            sentItem({
              sentItemId: "sent:branch",
              sectionId: "branch",
              branchName: "feature"
            })
          ].filter((item) =>
            item.branchName === branchName &&
            item.commitSha === commitSha &&
            item.itemKind !== excludedKind
          );
        }
      },
      contextPackItems: {
        listInvalidatedSentItemIdsBySession() {
          return ["sent:stale"];
        }
      }
    },
    sessionId: "session-1",
    branch: "main",
    commit: "abc123"
  });

  assert.deepEqual(inputs.map((item) => item.sentItemId), ["sent:task"]);
});

test("compression storage persists deterministic artifacts and their input hashes", () => {
  withMigratedDatabase((repositories) => {
    const artifact = buildSymbolOutlineCompressionArtifact(symbolOutlineInput());
    assert.ok(artifact);

    repositories.compressionArtifacts.upsert({
      compressionId: artifact.compressionId,
      projectId: artifact.projectId,
      repoId: artifact.repoId,
      repoSnapshotId: artifact.snapshotId,
      worktreeStateId: artifact.worktreeStateId,
      artifactType: artifact.type,
      method: artifact.method,
      summaryText: artifact.summaryText,
      inputHash: artifact.inputHash,
      policyHash: artifact.policyHash,
      scopeHash: artifact.scopeHash,
      outputHash: artifact.outputHash,
      trustStatus: "derived_cache",
      createdAt: artifact.createdAt,
      updatedAt: artifact.createdAt
    });

    for (const ref of artifact.inputRefs) {
      repositories.compressionInputs.upsert({
        compressionInputId: `input:${ref.ref}`,
        compressionId: artifact.compressionId,
        inputKind: ref.kind,
        inputRef: ref.ref,
        inputHash: ref.hash
      });
    }

    assert.equal(repositories.compressionArtifacts.get(artifact.compressionId)?.outputHash, artifact.outputHash);
    assert.equal(repositories.compressionArtifacts.listBySnapshot("snapshot-1").length, 1);
    assert.deepEqual(
      repositories.compressionInputs.listByArtifact(artifact.compressionId).map((input) => input.inputKind),
      ["symbol", "symbol"]
    );
  });
});

test("compression storage persists rule digest input hashes as rule inputs", () => {
  withMigratedDatabase((repositories) => {
    const artifact = buildRuleDigestCompressionArtifact(ruleDigestInput());
    assert.ok(artifact);

    repositories.compressionArtifacts.upsert({
      compressionId: artifact.compressionId,
      projectId: artifact.projectId,
      repoId: artifact.repoId,
      repoSnapshotId: artifact.snapshotId,
      worktreeStateId: artifact.worktreeStateId,
      artifactType: artifact.type,
      method: artifact.method,
      summaryText: artifact.summaryText,
      inputHash: artifact.inputHash,
      policyHash: artifact.policyHash,
      scopeHash: artifact.scopeHash,
      outputHash: artifact.outputHash,
      trustStatus: "derived_cache",
      createdAt: artifact.createdAt,
      updatedAt: artifact.createdAt
    });

    for (const ref of artifact.inputRefs) {
      repositories.compressionInputs.upsert({
        compressionInputId: `input:${ref.ref}`,
        compressionId: artifact.compressionId,
        inputKind: ref.kind,
        inputRef: ref.ref,
        inputHash: ref.hash
      });
    }

    assert.equal(repositories.compressionArtifacts.get(artifact.compressionId)?.artifactType, "rule_digest");
    assert.deepEqual(
      repositories.compressionInputs.listByArtifact(artifact.compressionId).map((input) => input.inputKind),
      ["rule"]
    );
  });
});

test("compression storage persists context pack summaries as context artifact inputs", () => {
  withMigratedDatabase((repositories) => {
    const artifact = buildContextPackSummaryCompressionArtifact(contextPackSummaryInput());
    assert.ok(artifact);

    repositories.compressionArtifacts.upsert({
      compressionId: artifact.compressionId,
      projectId: artifact.projectId,
      repoId: artifact.repoId,
      repoSnapshotId: artifact.snapshotId,
      worktreeStateId: artifact.worktreeStateId,
      artifactType: artifact.type,
      method: artifact.method,
      summaryText: artifact.summaryText,
      inputHash: artifact.inputHash,
      policyHash: artifact.policyHash,
      scopeHash: artifact.scopeHash,
      outputHash: artifact.outputHash,
      trustStatus: "derived_cache",
      createdAt: artifact.createdAt,
      updatedAt: artifact.createdAt
    });

    for (const ref of artifact.inputRefs) {
      repositories.compressionInputs.upsert({
        compressionInputId: `input:${ref.ref}`,
        compressionId: artifact.compressionId,
        inputKind: ref.kind,
        inputRef: ref.ref,
        inputHash: ref.hash
      });
    }

    assert.equal(repositories.compressionArtifacts.get(artifact.compressionId)?.artifactType, "context_pack_summary");
    assert.deepEqual(
      repositories.compressionInputs.listByArtifact(artifact.compressionId).map((input) => input.inputKind),
      ["context_artifact"]
    );
  });
});
