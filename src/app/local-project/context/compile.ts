import path from "node:path";

import { buildDurableContext } from "../../durable-context-build.js";
import { persistGitRepoSnapshot } from "../../persist-repo-snapshot.js";
import { persistProjectRuleClaims } from "../../persist-project-rules.js";
import { persistSourceExcerptClaims } from "../../persist-source-claims.js";
import { toContextPackItems } from "../../../core/compiler/index.js";
import { createGitRepoSnapshot } from "../../../core/git/index.js";
import { assertArtifactTextHasNoSecrets } from "../../../core/security/index.js";
import {
  createClaimStorageRepositories,
  createCompressionStorageRepositories,
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createProofStorageRepositories,
  createStorageRepositories
} from "../../../core/storage/index.js";
import { ensureLocalProjectLayout, readLocalProjectConfig } from "../setup/config.js";
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
import { toCompileLocalContextResult } from "./compile-result.js";
import { ensureCompileSession } from "./compile-session.js";
import {
  persistLocalContextPackSummaryCompressionArtifact
} from "./compression.js";
import { listContextPackSummarySentItems } from "./context-pack-summary.js";
import { resolveLocalCurrentValidClaims } from "../inspection/claim-resolution.js";
import { resolveLocalTaskRetrieval } from "./task-retrieval.js";
import { compileLocalRepositoryArtifact } from "./repository-artifact.js";
import { withRepairableMigratedLocalDatabase } from "../setup/storage.js";
import type { CompileLocalContextInput, CompileLocalContextResult } from "../types.js";
import type { LocalArtifactWriteResult } from "./artifact-files.js";
import { ensureLocalProjectBootstrapped } from "../setup/bootstrap.js";
import { writeLocalContextOutput } from "./context-output.js";

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
  const claimEnvironment = currentValidEnvironment(input.environmentScope);
  assertSafeId("session id", sessionId);
  const lockToken = createLockToken();

  const databaseResult = withRepairableMigratedLocalDatabase({
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
        snapshot,
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
        symbolEdges,
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
        environment: claimEnvironment,
        worktreeHash: snapshotResult.snapshot.worktreeHash,
        now
      });
      persistProjectRuleClaims({
        repositories: claimRepositories,
        proofRepositories,
        sources,
        sourceExcerpts: proofs.sourceExcerpts,
        branch: snapshotResult.snapshot.branch,
        commit: snapshotResult.snapshot.commit,
        environment: claimEnvironment,
        worktreeHash: snapshotResult.snapshot.worktreeHash,
        now
      });
      const currentValidClaims = resolveLocalCurrentValidClaims({
        claims: claimRepositories.claims,
        claimEdges: claimRepositories.claimEdges,
        proofs: proofRepositories.proofs,
        sources: evidenceRepositories.sources,
        snapshot: snapshotResult.snapshot,
        sessionId,
        environment: claimEnvironment,
        taskSourceRefs: proofs.taskRetrieval.selectedSourceRefs.length > 0
          ? proofs.taskRetrieval.selectedSourceRefs
          : undefined
      });
      const activeClaims = currentValidClaims.activeClaims.map((claim) => ({
        claimId: claim.claimId,
        claimType: claim.claimType,
        claimText: claim.claimText,
        scopeHash: claim.scopeHash,
        sourceRefs: claim.sourceRefs,
        proofRefs: claim.proofRefs
      }));
      const artifactTaskRetrieval = {
        ...proofs.taskRetrieval,
        warnings: [
          ...proofs.taskRetrieval.warnings,
          ...currentValidClaims.warnings.map((warning) => `current_valid_${warning}`)
        ]
      };
      const artifact = compileLocalRepositoryArtifact({
        repositories,
        compressionRepositories,
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
        activeClaims,
        taskRetrieval: artifactTaskRetrieval,
        now
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
      let build: ReturnType<typeof buildDurableContext> | undefined;
      try {
        build = buildDurableContext({
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
          tokenBudget: input.tokenBudget,
          prepareOutput(preview) {
            const contextPackItems = toContextPackItems(artifact, preview.contextPackItems);
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
              budget: preview.budget,
              tokenCost: preview.tokenMetric.grapeTokens,
              environmentScope: input.environmentScope
            });
          }
        });
        persistLocalContextPackSummaryCompressionArtifact({
          repositories: compressionRepositories,
          projectId: config.project.projectId,
          snapshotId: snapshotResult.snapshotId,
          worktreeStateId: snapshotResult.worktreeStateId,
          snapshot: snapshotResult.snapshot,
          sessionId,
          sentItems: listContextPackSummarySentItems({
            repositories,
            sessionId,
            branch: snapshotResult.snapshot.branch,
            commit: snapshotResult.snapshot.commit
          }),
          now
        });
      } finally {
        repositories.contextSessions.releaseLock({ sessionId, lockToken, now });
      }
      if (!build) throw new Error("context build did not produce a result");
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

  return toCompileLocalContextResult({
    rootPath: snapshot.rootPath,
    config,
    sessionId,
    taskId,
    riskOverlays: requestedRiskOverlays,
    environmentScope: input.environmentScope,
    value: databaseResult.value,
    databaseBackupPath: databaseResult.databaseBackupPath
  });
}

function currentValidEnvironment(environmentScope: CompileLocalContextInput["environmentScope"]): string | undefined {
  return environmentScope === "unknown" ? undefined : environmentScope;
}
