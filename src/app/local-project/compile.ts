import path from "node:path";

import { buildDurableContext } from "../durable-context-build.js";
import { persistGitRepoSnapshot } from "../persist-repo-snapshot.js";
import {
  compileRepositoryContextArtifact,
  renderRepositoryContextPackJson,
  renderRepositoryContextPackMarkdown
} from "../../core/compiler/index.js";
import { createGitRepoSnapshot } from "../../core/git/index.js";
import { assertArtifactTextHasNoSecrets } from "../../core/security/index.js";
import {
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
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
import { ensureCompileSession } from "./compile-session.js";
import { initializeLocalProject } from "./initialize.js";
import { readLocalSourceExcerpts } from "./source-excerpts.js";
import { withMigratedLocalDatabase } from "./storage.js";
import type { CompileLocalContextInput, CompileLocalContextResult } from "./types.js";
import type { LocalArtifactWriteResult } from "./artifact-files.js";
import { writeLocalArtifactFiles } from "./artifact-files.js";

export function compileLocalContext(input: CompileLocalContextInput): CompileLocalContextResult {
  const now = input.now ?? new Date().toISOString();
  const taskType = parseTaskType(input.taskType);
  const requestedRiskOverlays = mergeRiskOverlays(
    parseRiskOverlays(input.riskOverlays),
    detectRiskOverlaysForTask(input.task, input.riskSeedRefs)
  );
  const rootPath = path.resolve(input.rootPath);

  ensureBootstrapped({
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
      const sourceExcerpts = readLocalSourceExcerpts({
        rootPath: snapshot.rootPath,
        sources
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
        sourceExcerpts,
        symbolNodes: indexingRepositories.symbolNodes.listBySnapshot(snapshotResult.snapshotId),
        symbolEdges: indexingRepositories.symbolEdges.listBySnapshot(snapshotResult.snapshotId),
        createdAt: now
      });

      assertArtifactTextHasNoSecrets(JSON.stringify(artifact), "context artifact");

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
        prepareOutput(preview) {
          const renderInput = {
            artifact,
            contextPackItems: preview.contextPackItems,
            omittedItems: preview.omittedItems,
            tokenMetric: preview.tokenMetric
          };
          const json = renderRepositoryContextPackJson(renderInput);
          const markdown = renderRepositoryContextPackMarkdown(renderInput);
          assertArtifactTextHasNoSecrets(json, "context artifact JSON");
          assertArtifactTextHasNoSecrets(markdown, "context artifact Markdown");
          files = writeLocalArtifactFiles({
            artifactDirPath: layout.artifactDirPath,
            artifact,
            json,
            markdown
          });
        }
      });
      repositories.contextSessions.releaseLock({ sessionId, lockToken, now });
      if (!files) throw new Error("context artifact output was not prepared");

      return {
        snapshotResult,
        build,
        artifact,
        files
      };
    }
  });

  const value = databaseResult.value;
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
    contextPackItems: value.build.contextPackItems,
    omittedItemCount: value.build.omittedItems.length,
    sentItemCount: value.build.sentItems.length,
    tokenMetric: value.build.tokenMetric,
    warnings: value.artifact.warnings,
    unsafeReasons: value.artifact.unsafeReasons,
    artifactJsonPath: value.files.jsonPath,
    artifactMarkdownPath: value.files.markdownPath
  };
}

function ensureBootstrapped(input: {
  readonly rootPath: string;
  readonly now: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}): void {
  const snapshot = createGitRepoSnapshot({
    rootPath: input.rootPath,
    createdAt: input.now,
    gitBinary: input.gitBinary
  });
  const layout = ensureLocalProjectLayout(snapshot.rootPath);
  const config = readLocalProjectConfig(layout.configPath);
  if (config) return;

  initializeLocalProject({
    rootPath: snapshot.rootPath,
    connect: false,
    now: input.now,
    gitBinary: input.gitBinary,
    migrationsDir: input.migrationsDir
  });
}
