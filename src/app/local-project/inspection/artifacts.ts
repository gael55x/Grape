import { existsSync } from "node:fs";
import path from "node:path";

import { createGitRepoSnapshot } from "../../../core/git/index.js";
import { createStorageRepositories } from "../../../core/storage/index.js";
import type {
  ContextArtifactRecord,
  ContextDependencyRecord
} from "../../../core/storage/index.js";
import { artifactFileBaseName } from "../context/artifact-files.js";
import { ensureConfiguredLocalProjectLayout } from "../setup/configured-layout.js";
import { withMigratedLocalDatabase } from "../setup/storage.js";
import type {
  GetLocalArtifactInput,
  GetLocalArtifactResult,
  ListLocalArtifactsInput,
  ListLocalArtifactsResult,
  LocalArtifactDependencySummary,
  LocalArtifactFileRefs,
  LocalArtifactSummary
} from "../types.js";

export function listLocalArtifacts(input: ListLocalArtifactsInput): ListLocalArtifactsResult {
  const now = input.now ?? new Date().toISOString();
  const snapshot = createGitRepoSnapshot({
    rootPath: input.rootPath,
    createdAt: now,
    gitBinary: input.gitBinary
  });
  const { layout } = ensureConfiguredLocalProjectLayout(snapshot.rootPath);

  const databaseResult = withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database): readonly LocalArtifactSummary[] {
      const repositories = createStorageRepositories(database);
      const artifacts = input.sessionId
        ? repositories.contextArtifacts.listBySession(input.sessionId)
        : repositories.contextArtifacts.list();
      return artifacts.map((artifact) => toArtifactSummary(layout.rootPath, layout.artifactDirPath, artifact));
    }
  });

  return {
    rootPath: layout.rootPath,
    artifacts: databaseResult.value
  };
}

export function getLocalArtifact(input: GetLocalArtifactInput): GetLocalArtifactResult {
  const now = input.now ?? new Date().toISOString();
  const snapshot = createGitRepoSnapshot({
    rootPath: input.rootPath,
    createdAt: now,
    gitBinary: input.gitBinary
  });
  const { layout } = ensureConfiguredLocalProjectLayout(snapshot.rootPath);

  return withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database): GetLocalArtifactResult {
      const repositories = createStorageRepositories(database);
      const artifact = repositories.contextArtifacts.get(input.artifactId);
      if (!artifact) throw new Error(`context artifact was not found: ${input.artifactId}`);
      return {
        rootPath: layout.rootPath,
        ...toArtifactSummary(layout.rootPath, layout.artifactDirPath, artifact),
        dependencies: repositories.contextDependencies.listByArtifact(input.artifactId).map(toDependencySummary)
      };
    }
  }).value;
}

function toArtifactSummary(
  rootPath: string,
  artifactDirPath: string,
  artifact: ContextArtifactRecord
): LocalArtifactSummary {
  return {
    artifactId: artifact.artifactId,
    sessionId: artifact.sessionId,
    taskType: artifact.taskType,
    riskOverlays: parseStringArray(artifact.riskOverlaysJson, "risk overlays"),
    artifactHash: artifact.artifactHash,
    dependencyManifestHash: artifact.dependencyManifestHash,
    warnings: parseStringArray(artifact.warningsJson, "artifact warnings"),
    unsafeReasons: parseStringArray(artifact.unsafeReasonsJson, "artifact unsafe reasons"),
    createdAt: artifact.createdAt,
    artifactFiles: artifactFiles(rootPath, artifactDirPath, artifact.artifactId)
  };
}

function toDependencySummary(dependency: ContextDependencyRecord): LocalArtifactDependencySummary {
  return {
    dependencyId: dependency.dependencyId,
    kind: dependency.dependencyKind,
    ref: dependency.dependencyRef,
    hash: dependency.dependencyHash,
    scope: parseRecord(dependency.scopeJson, `dependency scope ${dependency.dependencyId}`)
  };
}

function artifactFiles(rootPath: string, artifactDirPath: string, artifactId: string): LocalArtifactFileRefs {
  const baseName = artifactFileBaseName(artifactId);
  const jsonPath = path.join(artifactDirPath, `${baseName}.json`);
  const markdownPath = path.join(artifactDirPath, `${baseName}.md`);
  return {
    json: repoRelativePath(rootPath, jsonPath),
    markdown: repoRelativePath(rootPath, markdownPath),
    jsonExists: existsSync(jsonPath),
    markdownExists: existsSync(markdownPath)
  };
}

function repoRelativePath(rootPath: string, value: string): string {
  return path.relative(rootPath, value).split(path.sep).join("/");
}

function parseStringArray(raw: string, label: string): readonly string[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error(`stored ${label} are not a string array`);
  }
  return parsed;
}

function parseRecord(raw: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`stored ${label} is not an object`);
  }
  return parsed as Record<string, unknown>;
}
