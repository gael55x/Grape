import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { persistGitRepoSnapshot, readLocalSourceExcerpts } from "../../../.tmp/build/src/app/index.js";
import {
  buildContextArtifact,
  compileRepositoryContextArtifact
} from "../../../.tmp/build/src/core/compiler/index.js";
import {
  applyStorageMigrations,
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createStorageRepositories,
  storageMigrationReferences
} from "../../../.tmp/build/src/core/storage/index.js";

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
  const dir = mkdtempSync(path.join(tmpdir(), "grape-repository-artifact-db-"));
  const database = new DatabaseSync(path.join(dir, "grape.db"));

  try {
    applyStorageMigrations(database, migrationSources(), () => now);
    fn(
      database,
      createStorageRepositories(database),
      createEvidenceStorageRepositories(database),
      createIndexingStorageRepositories(database)
    );
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-repository-artifact-repo-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, ".aiignore"), "private.ts\n");
    writeFileSync(path.join(dir, "AGENTS.md"), "Always run the relevant tests before finishing.\n");
    writeFileSync(path.join(dir, "package.json"), "{\"name\":\"artifact-fixture\"}\n");
    writeFileSync(path.join(dir, "package-lock.json"), "{\"lockfileVersion\":3}\n");
    writeFileSync(
      path.join(dir, "src", "lib.ts"),
      ["export class Calculator {}", "export function calculateDiscount() { return 10; }", ""].join("\n")
    );
    writeFileSync(
      path.join(dir, "src", "app.ts"),
      [
        "import { calculateDiscount } from './lib';",
        "const localValue = calculateDiscount();",
        "export function runApp() { return localValue; }",
        ""
      ].join("\n")
    );
    writeFileSync(path.join(dir, "private.ts"), "export const privateToken = 'PRIVATE=value';\n");
    execGit(dir, [
      "add",
      ".aiignore",
      "AGENTS.md",
      "package.json",
      "package-lock.json",
      "src/app.ts",
      "src/lib.ts",
      "private.ts"
    ]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "initial fixture"
    ]);

    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function withEmptyGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-repository-artifact-empty-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "--allow-empty",
      "-m",
      "initial empty fixture"
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

function compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, overrides = {}) {
  const snapshotId = snapshotResult.snapshotId;
  const sources = evidenceRepositories.sources.listBySnapshot(snapshotId);
  const taskRetrieval = overrides.taskRetrieval;
  return compileRepositoryContextArtifact({
    projectId: "project-1",
    sessionId: overrides.sessionId ?? "session-1",
    taskId: overrides.taskId ?? "task-1",
    taskType: overrides.taskType ?? "analysis",
    riskOverlays: overrides.riskOverlays ?? [],
    userRequestHash: overrides.userRequestHash ?? "u".repeat(64),
    snapshot: snapshotResult.snapshot,
    worktreeStateId: snapshotResult.worktreeStateId,
    sources,
    sourceExcerpts: readLocalSourceExcerpts({
      rootPath: repoPath,
      sources,
      preferredSourceRefs: taskRetrieval?.selectedSourceRefs,
      queryTerms: taskRetrieval?.queryTerms
    }),
    symbolNodes: indexingRepositories.symbolNodes.listBySnapshot(snapshotId),
    symbolEdges: indexingRepositories.symbolEdges.listBySnapshot(snapshotId),
    activeClaims: overrides.activeClaims,
    compressionArtifacts: overrides.compressionArtifacts,
    taskRetrieval,
    currentScope: overrides.currentScope,
    currentScopeWarnings: overrides.currentScopeWarnings,
    createdAt: overrides.createdAt ?? now
  });
}

test("repository artifact compiler derives a dependency-backed context artifact from persisted repo inputs", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
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

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories);
      const dependencyKinds = new Set(artifact.dependencyManifest.dependencies.map((dependency) => dependency.kind));
      const repoState = artifact.sections.find((section) => section.id === "repo-state");
      const sourceManifest = artifact.sections.find((section) => section.id === "source-manifest");
      const activeRules = artifact.sections.find((section) => section.id === "active-project-rules");
      const exactEvidence = artifact.sections.find((section) => section.id === "exact-source-evidence");
      const symbolSummary = artifact.sections.find((section) => section.id === "symbol-summary");
      const blindSpots = artifact.sections.find((section) => section.id === "index-blind-spots");
      const dependencyIds = new Set(
        artifact.dependencyManifest.dependencies.map((dependency) => dependency.id)
      );

      for (const section of artifact.sections) {
        assert.equal(
          section.dependencyRefs.includes("repo-snapshot"),
          true,
          `${section.id} has repo snapshot dependency`
        );
        assert.equal(
          section.dependencyRefs.includes("worktree-state"),
          true,
          `${section.id} has worktree dependency`
        );
      }

      assert.equal(artifact.input.branch, "main");
      assert.equal(artifact.input.commit, snapshotResult.snapshot.commit);
      assert.equal(artifact.input.worktreeHash, snapshotResult.snapshot.worktreeHash);
      assert.equal(artifact.dependencyManifest.hashAlgorithm, "sha256");
      assert.ok(artifact.dependencyManifest.manifestHash.length > 0);
      assert.ok(dependencyKinds.has("repo_snapshot"));
      assert.ok(dependencyKinds.has("worktree_state"));
      assert.ok(dependencyKinds.has("source_file"));
      assert.ok(dependencyKinds.has("rule"));
      assert.ok(dependencyKinds.has("config"));
      assert.ok(dependencyKinds.has("lockfile"));
      assert.ok(dependencyKinds.has("symbol"));

      assert.equal(repoState?.pinned, true);
      assert.equal(repoState?.dependencyRefs.includes("repo-snapshot"), true);
      assert.equal(sourceManifest?.sourceRefs.includes("src/app.ts"), true);
      assert.equal(sourceManifest?.dependencyRefs.includes("repo-snapshot"), true);
      assert.match(sourceManifest?.body ?? "", /package-lock\.json/);
      assert.equal(activeRules?.type, "pinned_rule");
      assert.equal(activeRules?.pinned, true);
      assert.equal(activeRules?.exactRequired, true);
      assert.equal(activeRules?.sourceRefs.includes("AGENTS.md"), true);
      assert.equal(activeRules?.proofRefs.every((proofRef) => proofRef.startsWith("proof:")), true);
      assert.equal(activeRules?.dependencyRefs.every((dependencyRef) => dependencyIds.has(dependencyRef)), true);
      assert.match(activeRules?.body ?? "", /Always run the relevant tests/);
      assert.equal(exactEvidence?.type, "code_span");
      assert.equal(exactEvidence?.exactRequired, true);
      assert.equal(exactEvidence?.sourceRefs.includes("src/app.ts"), true);
      assert.equal(exactEvidence?.sourceRefs.includes("AGENTS.md"), false);
      assert.equal(exactEvidence?.proofRefs.every((proofRef) => proofRef.startsWith("proof:")), true);
      assert.equal(
        exactEvidence?.dependencyRefs.some((dependencyRef) => dependencyRef.startsWith("proof:")),
        true
      );
      assert.match(exactEvidence?.body ?? "", /Proof: proof:/);
      assert.match(exactEvidence?.body ?? "", /export function runApp/);
      assert.match(symbolSummary?.body ?? "", /src\/app\.ts :: runApp/);
      assert.match(symbolSummary?.body ?? "", /imports: .* -> src\/lib\.ts/);
      assert.equal(
        artifact.dependencyManifest.dependencies
          .filter((dependency) => dependency.kind === "symbol")
          .every((dependency) => dependency.scope.path || dependency.scope.fromSymbolId),
        true
      );
      assert.equal(blindSpots?.pinned, false);
      assert.match(blindSpots?.body ?? "", /Selected provider capability summary:/);
      assert.match(
        blindSpots?.body ?? "",
        /typescript via typescript_ast: capabilities lexical_path, module_edges, symbols_ast, test_edges; gaps none\./
      );
      assert.match(blindSpots?.body ?? "", /Indexed provider capability summary:/);
      assert.match(
        blindSpots?.body ?? "",
        /typescript via typescript_ast: files 2; capabilities lexical_path, module_edges, symbols_ast, test_edges; gaps none\./
      );
      assert.equal(artifact.warnings.includes("repository_artifact_uses_lightweight_index"), true);
      assert.equal(JSON.stringify(artifact).includes("PRIVATE=value"), false);
    });
  });
});

test("repository artifact compiler dependency-backs selected package context with package manifests", () => {
  withGitRepo((repoPath) => {
    mkdirSync(path.join(repoPath, "packages", "api", "src"), { recursive: true });
    writeFileSync(
      path.join(repoPath, "packages", "api", "package.json"),
      JSON.stringify({ name: "api-fixture", dependencies: { express: "4.18.3" } }, null, 2)
    );
    writeFileSync(path.join(repoPath, "packages", "api", "package-lock.json"), "{\"lockfileVersion\":3}\n");
    writeFileSync(
      path.join(repoPath, "packages", "api", "src", "app.js"),
      "export function runApiApp() {\n  return 'api';\n}\n"
    );
    execGit(repoPath, ["add", "packages"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add package context fixture"
    ]);

    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
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
      const taskRetrieval = {
        selectedSourceRefs: ["packages/api/src/app.js"],
        rankedSourceRefs: ["packages/api/src/app.js"],
        semanticCandidates: [],
        explicitSourceRefs: ["packages/api/src/app.js"],
        testSourceRefs: [],
        relatedTestSourceRefs: [],
        relatedTestRelationships: [],
        graphSourceRefs: [],
        symbolSourceRefs: [],
        lexicalSourceRefs: [],
        queryTerms: ["api"],
        warnings: []
      };

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        taskRetrieval,
        currentScope: { packageRoot: "packages/api" }
      });
      const apiManifestDependency = artifact.dependencyManifest.dependencies.find(
        (dependency) => dependency.ref === "packages/api/package.json"
      );
      const apiLockfileDependency = artifact.dependencyManifest.dependencies.find(
        (dependency) => dependency.ref === "packages/api/package-lock.json"
      );
      const exactEvidence = artifact.sections.find((section) => section.id === "exact-source-evidence");
      const taskInputs = artifact.sections.find((section) => section.id === "task-retrieval");

      assert.equal(apiManifestDependency?.kind, "config");
      assert.equal(apiManifestDependency?.scope.packageRoot, "packages/api");
      assert.equal(apiManifestDependency?.scope.packageContextSource, true);
      assert.equal(apiLockfileDependency?.kind, "lockfile");
      assert.equal(apiLockfileDependency?.scope.packageContextSource, true);
      assert.ok(exactEvidence?.dependencyRefs.includes(apiManifestDependency.id));
      assert.ok(exactEvidence?.dependencyRefs.includes(apiLockfileDependency.id));
      assert.ok(taskInputs?.dependencyRefs.includes(apiManifestDependency.id));
      assert.ok(taskInputs?.dependencyRefs.includes(apiLockfileDependency.id));
    });
  });
});

test("repository artifact compiler uses indexed package-root metadata for nested manifest context", () => {
  withGitRepo((repoPath) => {
    mkdirSync(path.join(repoPath, "components", "backend", "src"), { recursive: true });
    writeFileSync(
      path.join(repoPath, "components", "backend", "pyproject.toml"),
      [
        "[project]",
        "name = \"backend-fixture\"",
        "dependencies = [\"fastapi\"]",
        ""
      ].join("\n")
    );
    writeFileSync(
      path.join(repoPath, "components", "backend", "src", "service.py"),
      [
        "def run_backend_service():",
        "    return \"backend\"",
        ""
      ].join("\n")
    );
    execGit(repoPath, ["add", "components"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add nested package context fixture"
    ]);

    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
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
      const taskRetrieval = {
        selectedSourceRefs: ["components/backend/src/service.py"],
        rankedSourceRefs: ["components/backend/src/service.py"],
        semanticCandidates: [],
        explicitSourceRefs: ["components/backend/src/service.py"],
        testSourceRefs: [],
        relatedTestSourceRefs: [],
        relatedTestRelationships: [],
        graphSourceRefs: [],
        symbolSourceRefs: [],
        lexicalSourceRefs: [],
        queryTerms: ["backend"],
        warnings: []
      };

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        taskRetrieval
      });
      const pyprojectDependency = artifact.dependencyManifest.dependencies.find(
        (dependency) => dependency.ref === "components/backend/pyproject.toml"
      );
      const exactEvidence = artifact.sections.find((section) => section.id === "exact-source-evidence");
      const taskInputs = artifact.sections.find((section) => section.id === "task-retrieval");
      const blindSpots = artifact.sections.find((section) => section.id === "index-blind-spots");

      assert.equal(artifact.input.packageRoot, undefined);
      assert.equal(pyprojectDependency?.kind, "config");
      assert.equal(pyprojectDependency?.scope.packageRoot, "components/backend");
      assert.equal(pyprojectDependency?.scope.packageContextSource, true);
      assert.ok(exactEvidence?.dependencyRefs.includes(pyprojectDependency.id));
      assert.ok(taskInputs?.dependencyRefs.includes(pyprojectDependency.id));
      assert.match(blindSpots?.body ?? "", /Selected package provider capability summary:/);
      assert.match(
        blindSpots?.body ?? "",
        /components\/backend: python via generic_text; files 1; capabilities lexical_path, symbols_basic; gaps module_edges, test_edges\./
      );
    });
  });
});

test("repository artifact compiler maps repository output to the V1 ContextArtifact shape", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
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

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories);
      const contextArtifact = buildContextArtifact({
        artifact,
        projectId: "project-1",
        repoSnapshotId: snapshotResult.snapshotId,
        worktreeStateId: snapshotResult.worktreeStateId,
        dirtyWorktree: false,
        budget: {
          status: "not_requested",
          estimatedPackTokens: 100,
          requiredContextTokens: 20,
          omittedDueToBudget: [],
          warnings: [],
          unsafeReasons: []
        },
        tokenCost: 100
      });

      const dependencyKinds = new Set(
        contextArtifact.dependencyManifest.dependencies.map((dependency) => dependency.kind)
      );
      const repoState = contextArtifact.outputSections.find((section) => section.id === "repo-state");
      const exactEvidence = contextArtifact.outputSections.find((section) => section.id === "exact-source-evidence");
      const inputRef = contextArtifact.inputRefs.find((ref) => ref.ref === "src/app.ts");

      assert.equal(contextArtifact.artifactFormatVersion, 1);
      assert.equal(contextArtifact.id, artifact.artifactId);
      assert.equal(contextArtifact.repoSnapshotId, snapshotResult.snapshotId);
      assert.equal(contextArtifact.worktreeStateId, snapshotResult.worktreeStateId);
      assert.equal(contextArtifact.compileMode, "partial_with_risk");
      assert.ok(contextArtifact.contentHash.length > 0);
      assert.ok(dependencyKinds.has("repo_snapshot"));
      assert.ok(dependencyKinds.has("worktree_state"));
      assert.ok(dependencyKinds.has("file"));
      assert.ok(dependencyKinds.has("rule"));
      assert.equal(repoState?.type, "repo_state");
      assert.equal(repoState?.pinned, true);
      assert.equal(repoState?.safetyCritical, true);
      assert.equal(exactEvidence?.type, "code_span");
      assert.equal(exactEvidence?.requiresExactCode, true);
      assert.equal(exactEvidence?.itemRefs.some((ref) => ref.kind === "proof"), true);
      assert.equal(inputRef?.dependencyStrength, "direct");
      assert.equal(inputRef?.scope.repoId, "repo-1");
    });
  });
});

test("repository artifact compiler renders current-valid claim sections with claim dependencies", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
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

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        activeClaims: [
          {
            claimId: "claim:source-excerpt",
            claimType: "repository_source_excerpt_exists",
            claimText: "Source src/app.ts contains the selected exact excerpt.",
            scopeHash: "c".repeat(64),
            sourceRefs: ["src/app.ts"],
            proofRefs: ["proof:source-excerpt"]
          }
        ]
      });
      const activeClaims = artifact.sections.find((section) => section.id === "current-valid-claims");
      const claimDependency = artifact.dependencyManifest.dependencies.find(
        (dependency) => dependency.ref === "claim:source-excerpt"
      );

      assert.equal(activeClaims?.type, "active_claim");
      assert.equal(activeClaims?.exactRequired, true);
      assert.deepEqual(activeClaims?.proofRefs, ["proof:source-excerpt"]);
      assert.equal(activeClaims?.dependencyRefs.includes("repo-snapshot"), true);
      assert.equal(activeClaims?.dependencyRefs.includes("worktree-state"), true);
      assert.match(activeClaims?.body ?? "", /repository_source_excerpt_exists/);
      assert.equal(claimDependency?.kind, "claim");
      assert.equal(claimDependency?.hash, "c".repeat(64));
    });
  });
});

test("repository artifact compiler dependency-backs related test relationship refs", () => {
  const artifact = compileRepositoryContextArtifact({
    projectId: "project-1",
    sessionId: "session-1",
    taskId: "task-1",
    taskType: "bug_fix",
    riskOverlays: [],
    userRequestHash: "u".repeat(64),
    snapshot: {
      snapshotId: "snapshot-1",
      repoId: "repo-1",
      branch: "main",
      commit: "commit-a",
      worktreeStatus: "clean",
      worktreeHash: "d".repeat(64),
      snapshotHash: "e".repeat(64),
      dirtyPaths: []
    },
    worktreeStateId: "worktree-state-1",
    sources: [
      {
        sourceId: "source-billing",
        sourceType: "repository_file",
        sourceRef: "src/billing.ts",
        sourceHash: "b".repeat(64),
        sourceScope: "committed",
        trustClass: "trusted",
        privacyStatus: "allowed",
        redactionStatus: "not_needed"
      },
      {
        sourceId: "source-billing-test",
        sourceType: "repository_file",
        sourceRef: "tests/billing.test.ts",
        sourceHash: "c".repeat(64),
        sourceScope: "committed",
        trustClass: "trusted",
        privacyStatus: "allowed",
        redactionStatus: "not_needed"
      }
    ],
    sourceExcerpts: [],
    symbolNodes: [],
    symbolEdges: [
      {
        edgeId: "symbol_edge:billing-test-import",
        projectId: "project-1",
        repoId: "repo-1",
        snapshotId: "snapshot-1",
        fromSymbolId: "symbol:test",
        toRef: "src/billing.ts",
        edgeType: "imports",
        confidence: "high",
        discoveryMethod: "ast",
        metadataJson: "{}",
        createdAt: now
      }
    ],
    taskRetrieval: {
      selectedSourceRefs: ["src/billing.ts", "tests/billing.test.ts"],
      rankedSourceRefs: ["src/billing.ts", "tests/billing.test.ts"],
      semanticCandidates: [],
      explicitSourceRefs: ["src/billing.ts"],
      testSourceRefs: [],
      relatedTestSourceRefs: ["tests/billing.test.ts"],
      relatedTestRelationships: [
        {
          relationshipRef: "symbol_edge:billing-test-import",
          testSourceRef: "tests/billing.test.ts",
          targetSourceRef: "src/billing.ts",
          relationship: "imports"
        }
      ],
      graphSourceRefs: [],
      symbolSourceRefs: ["src/billing.ts"],
      lexicalSourceRefs: [],
      queryTerms: ["billing"],
      warnings: []
    },
    createdAt: now
  });
  const retrieval = artifact.sections.find((section) => section.id === "task-retrieval");
  const relationshipDependency = artifact.dependencyManifest.dependencies.find(
    (dependency) => dependency.ref === "symbol_edge:billing-test-import"
  );

  assert.match(
    retrieval?.body ?? "",
    /tests\/billing\.test\.ts imports src\/billing\.ts \(relationshipRef: symbol_edge:billing-test-import\)/
  );
  assert.equal(relationshipDependency?.kind, "symbol");
  assert.equal(retrieval?.dependencyRefs.includes("symbol:billing-test-import"), true);
  assert.deepEqual(retrieval?.proofRefs, []);
});

test("repository artifact compiler renders compression artifacts as non-proof orientation", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
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

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        compressionArtifacts: [
          {
            compressionId: "compression:symbol_outline:abc",
            type: "symbol_outline",
            summaryText: "Deterministic symbol outline only.",
            inputRefs: ["symbol:module"],
            inputHashes: ["d".repeat(64)],
            inputHash: "e".repeat(64),
            policyHash: "f".repeat(64),
            scopeHash: "1".repeat(64),
            outputHash: "2".repeat(64)
          }
        ]
      });
      const compressionSection = artifact.sections.find((section) => section.id === "compression-orientation");
      const compressionDependency = artifact.dependencyManifest.dependencies.find(
        (dependency) => dependency.ref === "compression:symbol_outline:abc"
      );
      const contextArtifact = buildContextArtifact({
        artifact,
        projectId: "project-1",
        repoSnapshotId: snapshotResult.snapshotId,
        worktreeStateId: snapshotResult.worktreeStateId,
        dirtyWorktree: false,
        budget: {
          status: "not_requested",
          estimatedPackTokens: 100,
          requiredContextTokens: 20,
          omittedDueToBudget: [],
          warnings: [],
          unsafeReasons: []
        },
        tokenCost: 100
      });

      assert.equal(compressionSection?.type, "compression_orientation");
      assert.equal(compressionSection?.exactRequired, false);
      assert.deepEqual(compressionSection?.proofRefs, []);
      assert.equal(compressionDependency?.kind, "compression_artifact");
      assert.equal(compressionDependency?.hash, "2".repeat(64));
      assert.deepEqual(contextArtifact.compressionArtifactRefs, ["compression:symbol_outline:abc"]);
      assert.deepEqual(contextArtifact.compressionArtifactsUsed, ["compression:symbol_outline:abc"]);
    });
  });
});

test("repository artifact compiler is deterministic for unchanged persisted inputs", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
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

      const first = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories);
      const second = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories);
      const differentRisk = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        riskOverlays: ["security"]
      });
      const differentRequest = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        userRequestHash: "v".repeat(64)
      });
      const later = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        createdAt: "2026-05-24T00:00:01.000Z"
      });

      assert.equal(second.artifactId, first.artifactId);
      assert.equal(second.artifactHash, first.artifactHash);
      assert.equal(second.dependencyManifest.manifestHash, first.dependencyManifest.manifestHash);
      assert.deepEqual(second.sections, first.sections);
      assert.notEqual(differentRisk.artifactId, first.artifactId);
      assert.notEqual(differentRequest.artifactId, first.artifactId);
      assert.notEqual(later.artifactId, first.artifactId);
      assert.equal(later.artifactHash, first.artifactHash);
      assert.equal(later.dependencyManifest.manifestHash, first.dependencyManifest.manifestHash);
    });
  });
});

test("repository artifact compiler keeps empty repos inspectable with fallback dependencies", () => {
  withEmptyGitRepo((repoPath) => {
    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
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

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories);
      const sourceManifest = artifact.sections.find((section) => section.id === "source-manifest");
      const exactEvidence = artifact.sections.find((section) => section.id === "exact-source-evidence");
      const symbolSummary = artifact.sections.find((section) => section.id === "symbol-summary");

      assert.equal(snapshotResult.snapshot.files.length, 0);
      assert.equal(sourceManifest?.sourceRefs.length, 0);
      assert.equal(exactEvidence?.sourceRefs.length, 0);
      assert.equal(exactEvidence?.exactRequired, false);
      assert.deepEqual(sourceManifest?.dependencyRefs, ["repo-snapshot", "worktree-state"]);
      assert.deepEqual(symbolSummary?.dependencyRefs, ["repo-snapshot", "worktree-state"]);
      assert.match(sourceManifest?.body ?? "", /Allowed source records: 0/);
      assert.match(symbolSummary?.body ?? "", /Indexed symbol nodes: 0/);
      assert.equal(artifact.unsafeReasons.length, 0);
    });
  });
});

test("repository artifact compiler marks risky or dirty context explicitly", () => {
  withGitRepo((repoPath) => {
    writeFileSync(
      path.join(repoPath, "src", "app.ts"),
      [
        "import { calculateDiscount } from './lib';",
        "const localValue = calculateDiscount();",
        "export function runApp() { return localValue + 1; }",
        ""
      ].join("\n")
    );

    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
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

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        taskType: "refactor",
        riskOverlays: ["security"]
      });
      const blindSpots = artifact.sections.find((section) => section.id === "index-blind-spots");
      const repoState = artifact.sections.find((section) => section.id === "repo-state");

      assert.equal(snapshotResult.snapshot.worktreeStatus, "dirty");
      assert.equal(artifact.warnings.includes("dirty_worktree_context"), true);
      assert.equal(artifact.warnings.includes("risk_overlay_requires_exact_context"), true);
      assert.deepEqual(artifact.unsafeReasons, ["risk_overlay_missing_exact_context"]);
      assert.equal(blindSpots?.pinned, true);
      assert.match(repoState?.body ?? "", /src\/app\.ts/);
    });
  });
});

test("repository risk policy accepts task-selected exact source spans", () => {
  withGitRepo((repoPath) => {
    writeFileSync(
      path.join(repoPath, "src", "auth.ts"),
      [
        "export function requireSession(sessionId: string | undefined) {",
        "  if (!sessionId) return { status: 401 };",
        "  return { status: 200 };",
        "}",
        ""
      ].join("\n")
    );
    execGit(repoPath, ["add", "src/auth.ts"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add auth fixture"
    ]);

    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
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

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        riskOverlays: ["auth"],
        taskRetrieval: {
          selectedSourceRefs: ["src/auth.ts"],
          rankedSourceRefs: ["src/auth.ts"],
          semanticCandidates: [],
          explicitSourceRefs: [],
          testSourceRefs: [],
          relatedTestSourceRefs: [],
          relatedTestRelationships: [],
          graphSourceRefs: [],
          symbolSourceRefs: ["src/auth.ts"],
          lexicalSourceRefs: [],
          queryTerms: ["auth"],
          warnings: []
        }
      });
      const exactEvidence = artifact.sections.find((section) => section.id === "exact-source-evidence");

      assert.equal(artifact.warnings.includes("risk_overlay_requires_exact_context"), true);
      assert.deepEqual(artifact.unsafeReasons, []);
      assert.deepEqual(exactEvidence?.sourceRefs, ["src/auth.ts"]);
      assert.equal(exactEvidence?.exactRequired, true);
      assert.equal(exactEvidence?.proofRefs.length, 1);
    });
  });
});

test("repository risk policy accepts task-selected exact rule-file spans", () => {
  withGitRepo((repoPath) => {
    writeFileSync(
      path.join(repoPath, "AGENTS.md"),
      [
        "Auth changes require exact review of session token handling.",
        "Do not treat summaries as proof.",
        ""
      ].join("\n")
    );
    execGit(repoPath, ["add", "AGENTS.md"]);
    execGit(repoPath, [
      "-c", "user.name=Grape Test", "-c", "user.email=grape@example.test",
      "commit", "-m", "update auth rule fixture"
    ]);

    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
      const snapshotResult = persistGitRepoSnapshot({
        database, repositories, evidenceRepositories, indexingRepositories,
        rootPath: repoPath, projectId: "project-1", repoId: "repo-1", now
      });

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        riskOverlays: ["auth"],
        taskRetrieval: {
          selectedSourceRefs: ["AGENTS.md"],
          rankedSourceRefs: ["AGENTS.md"],
          semanticCandidates: [],
          explicitSourceRefs: ["AGENTS.md"],
          testSourceRefs: [],
          relatedTestSourceRefs: [],
          relatedTestRelationships: [],
          graphSourceRefs: [],
          symbolSourceRefs: [],
          lexicalSourceRefs: [],
          queryTerms: ["auth"],
          warnings: []
        }
      });
      const exactEvidence = artifact.sections.find((section) => section.id === "exact-source-evidence");

      assert.equal(artifact.warnings.includes("risk_overlay_requires_exact_context"), true);
      assert.deepEqual(artifact.unsafeReasons, []);
      assert.deepEqual(exactEvidence?.sourceRefs, ["AGENTS.md"]);
      assert.match(exactEvidence?.body ?? "", /Type: rule_file/);
    });
  });
});

test("repository risk policy rejects path-only auth matches for high-risk overlays", () => {
  withGitRepo((repoPath) => {
    mkdirSync(path.join(repoPath, "src", "auth"), { recursive: true });
    writeFileSync(
      path.join(repoPath, "src", "auth", "unrelated.ts"),
      [
        "export function add(left: number, right: number) {",
        "  return left + right;",
        "}",
        ""
      ].join("\n")
    );
    execGit(repoPath, ["add", "src/auth/unrelated.ts"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add auth path unrelated fixture"
    ]);

    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
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

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        riskOverlays: ["auth"],
        taskRetrieval: {
          selectedSourceRefs: ["src/auth/unrelated.ts"],
          rankedSourceRefs: ["src/auth/unrelated.ts"],
          semanticCandidates: [],
          explicitSourceRefs: [],
          testSourceRefs: [],
          relatedTestSourceRefs: [],
          relatedTestRelationships: [],
          graphSourceRefs: [],
          symbolSourceRefs: ["src/auth/unrelated.ts"],
          lexicalSourceRefs: [],
          queryTerms: ["add"],
          warnings: []
        }
      });

      assert.equal(artifact.warnings.includes("risk_overlay_requires_exact_context"), true);
      assert.deepEqual(artifact.unsafeReasons, ["risk_overlay_missing_exact_context"]);
    });
  });
});

test("repository risk policy rejects irrelevant exact source spans for high-risk overlays", () => {
  withGitRepo((repoPath) => {
    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
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

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        riskOverlays: ["auth"],
        taskRetrieval: {
          selectedSourceRefs: ["src/lib.ts"],
          rankedSourceRefs: ["src/lib.ts"],
          semanticCandidates: [],
          explicitSourceRefs: [],
          testSourceRefs: [],
          relatedTestSourceRefs: [],
          relatedTestRelationships: [],
          graphSourceRefs: [],
          symbolSourceRefs: ["src/lib.ts"],
          lexicalSourceRefs: [],
          queryTerms: ["calculator"],
          warnings: []
        }
      });

      assert.equal(artifact.warnings.includes("risk_overlay_requires_exact_context"), true);
      assert.deepEqual(artifact.unsafeReasons, ["risk_overlay_missing_exact_context"]);
    });
  });
});

test("repository risk policy rejects auth overlay when excerpt body contains only author substring", () => {
  withGitRepo((repoPath) => {
    writeFileSync(
      path.join(repoPath, "src", "author.ts"),
      [
        "export function getAuthor(id: string) {",
        "  return { author: id };",
        "}",
        ""
      ].join("\n")
    );
    execGit(repoPath, ["add", "src/author.ts"]);
    execGit(repoPath, [
      "-c", "user.name=Grape Test", "-c", "user.email=grape@example.test",
      "commit", "-m", "add author fixture"
    ]);

    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
      const snapshotResult = persistGitRepoSnapshot({
        database, repositories, evidenceRepositories, indexingRepositories,
        rootPath: repoPath, projectId: "project-1", repoId: "repo-1", now
      });

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        riskOverlays: ["auth"],
        taskRetrieval: {
          selectedSourceRefs: ["src/author.ts"],
          rankedSourceRefs: ["src/author.ts"],
          semanticCandidates: [],
          explicitSourceRefs: [],
          testSourceRefs: [],
          relatedTestSourceRefs: [],
          relatedTestRelationships: [],
          graphSourceRefs: [],
          symbolSourceRefs: ["src/author.ts"],
          lexicalSourceRefs: [],
          queryTerms: ["author"],
          warnings: []
        }
      });

      assert.equal(artifact.warnings.includes("risk_overlay_requires_exact_context"), true);
      assert.deepEqual(
        artifact.unsafeReasons, ["risk_overlay_missing_exact_context"],
        "body containing only 'author' must not satisfy the auth overlay"
      );
    });
  });
});

test("repository risk policy accepts auth overlay when excerpt body contains session token via camelCase", () => {
  withGitRepo((repoPath) => {
    writeFileSync(
      path.join(repoPath, "src", "session.ts"),
      [
        "export function requireSession(sessionId: string | undefined) {",
        "  if (!sessionId) return { status: 401 };",
        "  return { status: 200 };",
        "}",
        ""
      ].join("\n")
    );
    execGit(repoPath, ["add", "src/session.ts"]);
    execGit(repoPath, [
      "-c", "user.name=Grape Test", "-c", "user.email=grape@example.test",
      "commit", "-m", "add session fixture"
    ]);

    withMigratedDatabase((database, repositories, evidenceRepositories, indexingRepositories) => {
      const snapshotResult = persistGitRepoSnapshot({
        database, repositories, evidenceRepositories, indexingRepositories,
        rootPath: repoPath, projectId: "project-1", repoId: "repo-1", now
      });

      const artifact = compileFromSnapshot(repoPath, snapshotResult, evidenceRepositories, indexingRepositories, {
        riskOverlays: ["auth"],
        taskRetrieval: {
          selectedSourceRefs: ["src/session.ts"],
          rankedSourceRefs: ["src/session.ts"],
          semanticCandidates: [],
          explicitSourceRefs: [],
          testSourceRefs: [],
          relatedTestSourceRefs: [],
          relatedTestRelationships: [],
          graphSourceRefs: [],
          symbolSourceRefs: ["src/session.ts"],
          lexicalSourceRefs: [],
          queryTerms: ["session"],
          warnings: []
        }
      });

      assert.equal(artifact.warnings.includes("risk_overlay_requires_exact_context"), true);
      assert.deepEqual(
        artifact.unsafeReasons, [],
        "body containing requireSession (camelCase) must satisfy the auth overlay via shared tokenizer"
      );
    });
  });
});
