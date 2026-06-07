import type { DurableContextBuildResult } from "../../durable-context-build.js";
import type { PersistGitRepoSnapshotResult } from "../../persist-repo-snapshot.js";
import { toContextPackItems } from "../../../core/compiler/index.js";
import type { InMemoryContextArtifactShape, RiskOverlay } from "../../../shared/index.js";
import type { LocalArtifactWriteResult } from "./artifact-files.js";
import type { LocalProjectConfig } from "../setup/config.js";
import { projectLocalContextArtifact } from "./context-output.js";
import { recoveryGuidanceForCompileResult } from "../setup/recovery.js";
import type { CompileLocalContextResult } from "../types.js";
import type { PublicCurrentScopeShape } from "../../../core/scope/index.js";

export interface LocalCompileDatabaseValue {
  readonly snapshotResult: PersistGitRepoSnapshotResult;
  readonly build: DurableContextBuildResult;
  readonly artifact: InMemoryContextArtifactShape;
  readonly files: LocalArtifactWriteResult;
  readonly currentScope: PublicCurrentScopeShape;
  readonly sessionResetId?: string;
}

export interface LocalCompileResultInput {
  readonly rootPath: string;
  readonly config: LocalProjectConfig;
  readonly sessionId: string;
  readonly taskId: string;
  readonly riskOverlays: readonly RiskOverlay[];
  readonly environmentScope?: CompileLocalContextResult["contextArtifact"]["environmentScope"];
  readonly currentScope: PublicCurrentScopeShape;
  readonly value: LocalCompileDatabaseValue;
  readonly databaseBackupPath?: string;
}

export function toCompileLocalContextResult(input: LocalCompileResultInput): CompileLocalContextResult {
  const contextPackItems = toContextPackItems(input.value.artifact, input.value.build.contextPackItems);
  const budget = input.value.build.budget;
  const contextArtifact = projectLocalContextArtifact({
    artifact: input.value.artifact,
    projectId: input.config.project.projectId,
    repoSnapshotId: input.value.snapshotResult.snapshotId,
    worktreeStateId: input.value.snapshotResult.worktreeStateId,
    dirtyWorktree: input.value.snapshotResult.snapshot.worktreeStatus !== "clean",
    budget,
    tokenCost: input.value.build.tokenMetric.grapeTokens,
    environmentScope: input.environmentScope,
    currentScope: input.currentScope
  });
  const warnings = [
    ...input.value.artifact.warnings,
    ...budget.warnings,
    ...(input.databaseBackupPath ? ["local_database_repaired"] : [])
  ];
  const unsafeReasons = [...input.value.artifact.unsafeReasons, ...budget.unsafeReasons];

  return {
    rootPath: input.rootPath,
    projectId: input.config.project.projectId,
    repoId: input.config.project.repoId,
    sessionId: input.sessionId,
    taskId: input.taskId,
    riskOverlays: input.riskOverlays,
    artifactId: input.value.artifact.artifactId,
    artifactHash: input.value.artifact.artifactHash,
    dependencyManifestHash: input.value.artifact.dependencyManifest.manifestHash,
    branch: input.value.snapshotResult.snapshot.branch,
    headCommit: input.value.snapshotResult.snapshot.commit,
    dirtyWorktree: input.value.snapshotResult.snapshot.worktreeStatus !== "clean",
    currentScope: input.currentScope,
    contextPackItems,
    contextArtifact,
    omittedItemCount: input.value.build.omittedItems.length,
    sentItemCount: input.value.build.sentItems.length,
    tokenMetric: input.value.build.tokenMetric,
    budget,
    warnings,
    unsafeReasons,
    recoveryGuidance: recoveryGuidanceForCompileResult({ warnings, unsafeReasons, budget }),
    artifactJsonPath: input.value.files.jsonPath,
    artifactMarkdownPath: input.value.files.markdownPath,
    databaseBackupPath: input.databaseBackupPath,
    sessionResetId: input.value.sessionResetId
  };
}
