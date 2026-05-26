import path from "node:path";

import { buildDurableContext } from "../durable-context-build.js";
import { persistGitRepoSnapshot } from "../persist-repo-snapshot.js";
import { persistSourceExcerptClaims } from "../persist-source-claims.js";
import {
  compileRepositoryContextArtifact,
  evaluateContextPackBudget,
  toContextPackItems
} from "../../core/compiler/index.js";
import { createGitRepoSnapshot } from "../../core/git/index.js";
import { assertArtifactTextHasNoSecrets } from "../../core/security/index.js";
import {
  createClaimStorageRepositories,
  createCompressionStorageRepositories,
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createProofStorageRepositories,
  createStorageRepositories
} from "../../core/storage/index.js";
import { ensureLocalProjectLayout, readLocalProjectConfig } from "./config.js";
import {
  assertSafeId,
  createLockToken,
  parseRiskOverlays,
  parseTaskType,
  sessionIdFor,
  sha256,
  taskIdFor
} from "./compile-ids.js";
import { detectRiskOverlaysForTask, mergeRiskOverlays } from "./compile-risk.js";
import { prepareLocalCompileProofs } from "./compile-proofs.js";
import { ensureCompileSession } from "./compile-session.js";
import { prepareLocalCompressionArtifacts } from "./compression.js";
import { resolveLocalCurrentValidClaims } from "./claim-resolution.js";
import { resolveLocalTaskRetrieval } from "./task-retrieval.js";
import { withMigratedLocalDatabase } from "./storage.js";
import type { CompileLocalContextInput, CompileLocalContextResult } from "./types.js";
import type { LocalArtifactWriteResult } from "./artifact-files.js";
import { ensureLocalProjectBootstrapped } from "./bootstrap.js";
import { projectLocalContextArtifact, writeLocalContextOutput } from "./context-output.js";

export function compileLocalContext(input: CompileLocalContextInput): CompileLocalContextResult {
  const now = input.now ?? new Date().toISOString();
  const taskType = parseTaskType(input.taskType);
  const requestedRiskOverlays = mergeRiskOverlays(
    parseRiskOverlays(input.riskOverlays),
    detectRiskOverlaysForTask(input.task, input.riskSeedRefs)
  );
  const rootPath = path.resolve(input.rootPath);

  ensureLocalProjectBootstrapped({
    rootPath,
    now,
    gitBinary: input.gitBinary,
    migrationsDir: input.migrationsDir
  });

  const snapshot = createGitRepoSnapshot({ rootPath, createdAt: now, gitBinary: input.gitBinary });
  const layout = ensureLocalProjectLayout(snapshot.rootPath);
  const config = readLocalProjectConfig(layout.configPath);
  if (!config) throw new Error("Grape config is missing. Run grape init --connect.");
  if (path.resolve(config.project.rootPath) !== snapshot.rootPath) {
    throw new Error("Grape config root path does not match the current repository path.");
  }

  const taskId = taskIdFor(input.task, taskType, requestedRiskOverlays);
  const sessionId = input.sessionId ?? sessionIdFor(snapshot.repoId, snapshot.branch, taskId);
  assertSafeId("session id", sessionId);
  const lockToken = createLockToken();

  const databaseResult = withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database) {
      const repositories = createStorageRepositories(database);
      const evidenceRepositories = createEvidenceStorageRepositories(database);
      const indexingRepositories = createIndexingStorageRepositories(database);
      const proofRepositories = createProofStorageRepositories(database);
      const claimRepositories = createClaimStorageRepositories(database);
      const compressionRepositories = createCompressionStorageRepositories(database);
      const snapshotResult = persistGitRepoSnapshot({
        database,
        repositories,
        evidenceRepositories,
        indexingRepositories,
        rootPath: snapshot.rootPath,
        projectId: config.project.projectId,
        repoId: config.project.repoId,
        gitBinary: input.gitBinary,
        now
      });

      const session = ensureCompileSession({
        existing: repositories.contextSessions.get(sessionId),
        sessionId,
        lockToken,
        projectId: config.project.projectId,
        repoId: config.project.repoId,
        snapshotId: snapshotResult.snapshotId,
        worktreeStateId: snapshotResult.worktreeStateId,
        branch: snapshotResult.snapshot.branch,
        commit: snapshotResult.snapshot.commit,
        taskId,
        taskType,
        now
      });
      if (!session.existed) repositories.contextSessions.insert(session.record);

      const sources = evidenceRepositories.sources.listBySnapshot(snapshotResult.snapshotId);
      const symbolNodes = indexingRepositories.symbolNodes.listBySnapshot(snapshotResult.snapshotId);
      const symbolEdges = indexingRepositories.symbolEdges.listBySnapshot(snapshotResult.snapshotId);
      const taskRetrieval = resolveLocalTaskRetrieval({
        task: input.task,
        snapshotId: snapshotResult.snapshotId,
        sources,
        symbolNodes,
        indexingRepositories,
        seedFiles: input.seedFiles,
        seedSymbols: input.seedSymbols,
        seedTests: input.seedTests
      });
      const proofs = prepareLocalCompileProofs({
        database,
        proofRepositories,
        rootPath: snapshot.rootPath,
        sources,
        taskRetrieval,
        now
      });
      persistSourceExcerptClaims({
        repositories: claimRepositories,
        proofRepositories,
        sources,
        sourceExcerpts: proofs.sourceExcerpts,
        branch: snapshotResult.snapshot.branch,
        commit: snapshotResult.snapshot.commit,
        worktreeHash: snapshotResult.snapshot.worktreeHash,
        now
      });
      const currentValidClaims = resolveLocalCurrentValidClaims({
        claims: claimRepositories.claims,
        proofs: proofRepositories.proofs,
        sources: evidenceRepositories.sources,
        snapshot: snapshotResult.snapshot
      });
      const compressionArtifacts = prepareLocalCompressionArtifacts({
        repositories: compressionRepositories,
        projectId: config.project.projectId,
        snapshotId: snapshotResult.snapshotId,
        worktreeStateId: snapshotResult.worktreeStateId,
        snapshot: snapshotResult.snapshot,
        symbolNodes,
        symbolEdges,
        now
      });
      const artifact = compileRepositoryContextArtifact({
        projectId: config.project.projectId,
        sessionId,
        taskId,
        taskType,
        riskOverlays: requestedRiskOverlays,
        userRequestHash: sha256(input.task),
        snapshot: snapshotResult.snapshot,
        worktreeStateId: snapshotResult.worktreeStateId,
        sources,
        sourceExcerpts: proofs.sourceExcerpts,
        symbolNodes,
        symbolEdges,
        activeClaims: currentValidClaims.activeClaims.map((claim) => ({
          claimId: claim.claimId,
          claimType: claim.claimType,
          claimText: claim.claimText,
          scopeHash: claim.scopeHash,
          sourceRefs: claim.sourceRefs,
          proofRefs: claim.proofRefs
        })),
        compressionArtifacts,
        taskRetrieval: proofs.taskRetrieval,
        createdAt: now
      });

      assertArtifactTextHasNoSecrets(JSON.stringify(artifact), "context artifact");
      const sessionReset = input.resetSession && session.existed
        ? {
            resetId: `reset:${artifact.artifactId}`,
            reason: "agent_session_reset" as const
          }
        : undefined;

      const turn = repositories.sessionEvents
        .listBySession(sessionId)
        .filter((event) => event.eventType === "context_pack_persisted").length + 1;
      let files: LocalArtifactWriteResult | undefined;
      const build = buildDurableContext({
        database,
        repositories,
        sessionId,
        lockToken,
        snapshotId: snapshotResult.snapshotId,
        artifact,
        fixture: "local-repository",
        turn,
        now,
        sessionUpdate: session.existed
          ? {
              sessionId,
              repoSnapshotId: session.record.repoSnapshotId,
              worktreeStateId: session.record.worktreeStateId,
              branchName: session.record.branchName,
              baseCommitSha: session.record.baseCommitSha,
              headCommitSha: session.record.headCommitSha,
              status: session.record.status,
              now
            }
          : undefined,
        sessionInvalidation:
          session.branchChanged && session.previousBranch && session.previousHeadCommit
            ? {
                reason: "branch_changed",
                previousBranch: session.previousBranch,
                nextBranch: snapshotResult.snapshot.branch,
                previousHeadCommit: session.previousHeadCommit,
                nextHeadCommit: snapshotResult.snapshot.commit
              }
            : undefined,
        sessionReset,
        prepareOutput(preview) {
          const contextPackItems = toContextPackItems(artifact, preview.contextPackItems);
          const budget = evaluateContextPackBudget({
            tokenBudget: input.tokenBudget,
            contextPackItems,
            estimatedPackTokens: preview.tokenMetric.grapeTokens
          });
          files = writeLocalContextOutput({
            artifactDirPath: layout.artifactDirPath,
            contextPackItems,
            omittedItems: preview.omittedItems,
            tokenMetric: preview.tokenMetric,
            artifact,
            projectId: config.project.projectId,
            repoSnapshotId: snapshotResult.snapshotId,
            worktreeStateId: snapshotResult.worktreeStateId,
            dirtyWorktree: snapshotResult.snapshot.worktreeStatus !== "clean",
            budget,
            tokenCost: preview.tokenMetric.grapeTokens
          });
        }
      });
      repositories.contextSessions.releaseLock({ sessionId, lockToken, now });
      if (!files) throw new Error("context artifact output was not prepared");

      return {
        snapshotResult,
        build,
        artifact,
        files,
        sessionResetId: sessionReset?.resetId
      };
    }
  });

  const value = databaseResult.value;
  const contextPackItems = toContextPackItems(value.artifact, value.build.contextPackItems);
  const budget = evaluateContextPackBudget({
    tokenBudget: input.tokenBudget,
    contextPackItems,
    estimatedPackTokens: value.build.tokenMetric.grapeTokens
  });
  const contextArtifact = projectLocalContextArtifact({
    artifact: value.artifact,
    projectId: config.project.projectId,
    repoSnapshotId: value.snapshotResult.snapshotId,
    worktreeStateId: value.snapshotResult.worktreeStateId,
    dirtyWorktree: value.snapshotResult.snapshot.worktreeStatus !== "clean",
    budget,
    tokenCost: value.build.tokenMetric.grapeTokens
  });
  return {
    rootPath: snapshot.rootPath,
    projectId: config.project.projectId,
    repoId: config.project.repoId,
    sessionId,
    taskId,
    riskOverlays: requestedRiskOverlays,
    artifactId: value.artifact.artifactId,
    artifactHash: value.artifact.artifactHash,
    dependencyManifestHash: value.artifact.dependencyManifest.manifestHash,
    branch: value.snapshotResult.snapshot.branch,
    headCommit: value.snapshotResult.snapshot.commit,
    dirtyWorktree: value.snapshotResult.snapshot.worktreeStatus !== "clean",
    contextPackItems,
    contextArtifact,
    omittedItemCount: value.build.omittedItems.length,
    sentItemCount: value.build.sentItems.length,
    tokenMetric: value.build.tokenMetric,
    budget,
    warnings: [...value.artifact.warnings, ...budget.warnings],
    unsafeReasons: [...value.artifact.unsafeReasons, ...budget.unsafeReasons],
    artifactJsonPath: value.files.jsonPath,
    artifactMarkdownPath: value.files.markdownPath,
    sessionResetId: value.sessionResetId
  };
}
