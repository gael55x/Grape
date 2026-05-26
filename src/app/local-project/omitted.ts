import path from "node:path";

import { createGitRepoSnapshot } from "../../core/git/index.js";
import { assertArtifactTextHasNoSecrets } from "../../core/security/index.js";
import { createStorageRepositories } from "../../core/storage/index.js";
import type {
  OmittedContextItemRecord,
  StorageRepositories
} from "../../core/storage/index.js";
import type {
  InMemoryContextArtifactShape,
  InMemoryContextDependencyShape
} from "../../shared/index.js";
import { ensureLocalProjectLayout, readLocalProjectConfig } from "./config.js";
import { loadVerifiedOmittedArtifact } from "./omitted-artifact.js";
import { withMigratedLocalDatabase } from "./storage.js";
import type {
  ListOmittedContextInput,
  ListOmittedContextResult,
  OmittedContextSummary,
  RestoreOmittedContextInput,
  RestoreOmittedContextResult
} from "./types.js";

export function listOmittedContext(input: ListOmittedContextInput): ListOmittedContextResult {
  const snapshot = createGitRepoSnapshot({
    rootPath: input.rootPath,
    createdAt: new Date().toISOString()
  });
  const layout = ensureConfiguredLayout(snapshot.rootPath);
  const databaseResult = withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => new Date().toISOString(),
    operation(database): OmittedContextSummary[] {
      const repositories = createStorageRepositories(database);
      return repositories.omittedContextItems.listBySession(input.sessionId).map(toSummary);
    }
  });

  return {
    rootPath: layout.rootPath,
    sessionId: input.sessionId,
    omittedItems: databaseResult.value
  };
}

export function restoreOmittedContext(input: RestoreOmittedContextInput): RestoreOmittedContextResult {
  const now = input.now ?? new Date().toISOString();
  const currentSnapshot = createGitRepoSnapshot({
    rootPath: input.rootPath,
    createdAt: now,
    gitBinary: input.gitBinary
  });
  const layout = ensureConfiguredLayout(currentSnapshot.rootPath);

  return withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database): RestoreOmittedContextResult {
      const repositories = createStorageRepositories(database);
      const omitted = requireOmittedItem(repositories, input.sessionId, input.restoreToken);
      const { artifact, section } = loadVerifiedOmittedArtifact({
        artifactDirPath: layout.artifactDirPath,
        repositories,
        omitted
      });
      const staleReason = dependencyStaleReason(artifact, omitted, currentSnapshot);

      if (staleReason) {
        return {
          status: "stale",
          rootPath: layout.rootPath,
          sessionId: input.sessionId,
          restoreToken: input.restoreToken,
          artifactId: omitted.artifactId,
          sectionId: omitted.sectionId,
          reason: staleReason,
          warnings: ["restore_token_rejects_stale_dependency"]
        };
      }

      assertArtifactTextHasNoSecrets(section.body, "restored omitted context");
      return {
        status: "restored",
        rootPath: layout.rootPath,
        sessionId: input.sessionId,
        restoreToken: input.restoreToken,
        artifactId: omitted.artifactId,
        sectionId: omitted.sectionId,
        title: section.title,
        body: section.body,
        contentHash: section.contentHash,
        warnings: []
      };
    }
  }).value;
}

function ensureConfiguredLayout(rootPath: string): ReturnType<typeof ensureLocalProjectLayout> & { readonly rootPath: string } {
  const layout = ensureLocalProjectLayout(rootPath);
  const config = readLocalProjectConfig(layout.configPath);
  if (!config) throw new Error("Grape config is missing. Run grape init --connect.");
  if (path.resolve(config.project.rootPath) !== layout.rootPath) {
    throw new Error("Grape config root path does not match the current repository path.");
  }
  return layout;
}

function requireOmittedItem(
  repositories: StorageRepositories,
  sessionId: string,
  restoreToken: string
): OmittedContextItemRecord {
  const omitted = repositories.omittedContextItems.getBySessionAndRestoreId(sessionId, restoreToken);
  if (!omitted || !omitted.canRestore || omitted.restoreId !== restoreToken) {
    throw new Error("omitted context restore token was not found for this session");
  }
  return omitted;
}

function dependencyStaleReason(
  artifact: InMemoryContextArtifactShape,
  omitted: OmittedContextItemRecord,
  currentSnapshot: ReturnType<typeof createGitRepoSnapshot>
): string | undefined {
  if (artifact.input.branch !== currentSnapshot.branch) return "branch_changed";
  if (artifact.input.commit !== currentSnapshot.commit) return "head_commit_changed";
  if (artifact.input.worktreeHash !== currentSnapshot.worktreeHash) return "worktree_hash_changed";
  if (artifact.dependencyManifest.manifestHash !== omitted.dependencyManifestHash) return "manifest_hash_changed";

  const currentFiles = new Map(currentSnapshot.files.map((file) => [file.path, file.sha256]));
  for (const dependency of artifact.dependencyManifest.dependencies) {
    const stale = sourceDependencyStaleReason(dependency, currentFiles);
    if (stale) return stale;
  }
  return undefined;
}

function sourceDependencyStaleReason(
  dependency: InMemoryContextDependencyShape,
  currentFiles: ReadonlyMap<string, string>
): string | undefined {
  if (!["source_file", "config", "lockfile", "rule"].includes(dependency.kind)) return undefined;
  const currentHash = currentFiles.get(dependency.ref);
  if (!currentHash) return `dependency_missing:${dependency.ref}`;
  if (currentHash !== dependency.hash) return `dependency_hash_changed:${dependency.ref}`;
  return undefined;
}

function toSummary(item: OmittedContextItemRecord): OmittedContextSummary {
  return {
    omittedItemId: item.omittedItemId,
    sessionId: item.sessionId,
    artifactId: item.artifactId,
    sectionId: item.sectionId,
    restoreId: item.restoreId ?? "",
    restoreCommand: item.restoreCommand ?? "",
    contentHash: item.contentHash,
    reasonOmitted: item.reasonOmitted,
    omittedAt: item.omittedAt,
    tokenCount: item.tokenCount
  };
}
