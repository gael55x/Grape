import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { assertRepositoryContextArtifactIntegrity } from "../../../core/compiler/index.js";
import type {
  ContextArtifactRecord,
  ContextDependencyRecord,
  OmittedContextItemRecord,
  StorageRepositories
} from "../../../core/storage/index.js";
import type {
  InMemoryContextArtifactShape,
  InMemoryContextSectionShape
} from "../../../shared/index.js";
import { toStorageDependencyKind } from "../../durable-context-records.js";
import { artifactFileBaseName } from "../context/artifact-files.js";

export interface VerifiedOmittedArtifactInput {
  readonly artifactDirPath: string;
  readonly repositories: StorageRepositories;
  readonly omitted: OmittedContextItemRecord;
}

export interface VerifiedOmittedArtifact {
  readonly artifact: InMemoryContextArtifactShape;
  readonly section: InMemoryContextSectionShape;
}

export function loadVerifiedOmittedArtifact(
  input: VerifiedOmittedArtifactInput
): VerifiedOmittedArtifact {
  const artifact = readStoredArtifact(input.artifactDirPath, input.omitted.artifactId);
  const artifactRecord = requireStoredArtifactRecord(input.repositories, input.omitted);
  assertStoredDependenciesMatchArtifact(
    artifact,
    input.repositories.contextDependencies.listByArtifact(input.omitted.artifactId)
  );
  assertRepositoryContextArtifactIntegrity({
    artifact,
    snapshotId: artifactRecord.snapshotId,
    expectedArtifactHash: artifactRecord.artifactHash,
    expectedDependencyManifestHash: artifactRecord.dependencyManifestHash
  });

  return {
    artifact,
    section: requireArtifactSection(artifact, input.omitted)
  };
}

function requireStoredArtifactRecord(
  repositories: StorageRepositories,
  omitted: OmittedContextItemRecord
): ContextArtifactRecord {
  const artifact = repositories.contextArtifacts.get(omitted.artifactId);
  if (!artifact) throw new Error("omitted restore artifact metadata was not found");
  if (artifact.sessionId !== omitted.sessionId) {
    throw new Error("omitted restore artifact metadata belongs to a different session");
  }
  if (artifact.dependencyManifestHash !== omitted.dependencyManifestHash) {
    throw new Error("omitted restore artifact metadata dependency manifest does not match omitted item");
  }
  return artifact;
}

function readStoredArtifact(artifactDirPath: string, artifactId: string): InMemoryContextArtifactShape {
  const artifactPath = storedRepositoryArtifactPath(artifactDirPath, artifactId);
  if (!existsSync(artifactPath)) {
    throw new Error(`context artifact file is missing for omitted restore: ${artifactId}`);
  }

  const parsed = JSON.parse(readFileSync(artifactPath, "utf8")) as { readonly artifact?: unknown };
  if (!isArtifactShape(parsed.artifact)) {
    throw new Error(`context artifact file has an unsupported shape: ${artifactId}`);
  }
  return parsed.artifact;
}

function storedRepositoryArtifactPath(artifactDirPath: string, artifactId: string): string {
  const baseName = artifactFileBaseName(artifactId);
  const repositoryArtifactPath = path.join(artifactDirPath, `${baseName}.repository.json`);
  if (existsSync(repositoryArtifactPath)) return repositoryArtifactPath;
  return path.join(artifactDirPath, `${baseName}.json`);
}

function assertStoredDependenciesMatchArtifact(
  artifact: InMemoryContextArtifactShape,
  storedDependencies: readonly ContextDependencyRecord[]
): void {
  const dependencies = artifact.dependencyManifest.dependencies;
  if (storedDependencies.length !== dependencies.length) {
    throw new Error("context artifact dependency count does not match stored metadata");
  }

  const storedById = new Map(storedDependencies.map((dependency) => [dependency.dependencyId, dependency]));
  const seenIds = new Set<string>();
  for (const dependency of dependencies) {
    const dependencyId = `${artifact.artifactId}:${dependency.id}`;
    if (seenIds.has(dependencyId)) {
      throw new Error(`context artifact dependency is duplicated: ${dependency.id}`);
    }
    seenIds.add(dependencyId);

    const stored = storedById.get(dependencyId);
    if (!stored) throw new Error(`context artifact dependency metadata is missing: ${dependency.id}`);
    if (stored.artifactId !== artifact.artifactId) {
      throw new Error(`context artifact dependency metadata has wrong artifact: ${dependency.id}`);
    }
    if (stored.dependencyKind !== toStorageDependencyKind(dependency)) {
      throw new Error(`context artifact dependency kind does not match stored metadata: ${dependency.id}`);
    }
    if (stored.dependencyRef !== dependency.ref) {
      throw new Error(`context artifact dependency ref does not match stored metadata: ${dependency.id}`);
    }
    if (stored.dependencyHash !== dependency.hash) {
      throw new Error(`context artifact dependency hash does not match stored metadata: ${dependency.id}`);
    }
    if (stored.scopeJson !== JSON.stringify(dependency.scope)) {
      throw new Error(`context artifact dependency scope does not match stored metadata: ${dependency.id}`);
    }
  }
}

function requireArtifactSection(
  artifact: InMemoryContextArtifactShape,
  omitted: OmittedContextItemRecord
): InMemoryContextSectionShape {
  if (artifact.artifactId !== omitted.artifactId) {
    throw new Error("omitted restore artifact identity does not match stored artifact");
  }
  if (artifact.dependencyManifest.manifestHash !== omitted.dependencyManifestHash) {
    throw new Error("omitted restore dependency manifest does not match stored artifact");
  }
  const section = artifact.sections.find((candidate) => candidate.id === omitted.sectionId);
  if (!section || section.contentHash !== omitted.contentHash) {
    throw new Error("omitted restore section content hash does not match stored artifact");
  }
  return section;
}

function isArtifactShape(value: unknown): value is InMemoryContextArtifactShape {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Partial<InMemoryContextArtifactShape>;
  return (
    typeof candidate.artifactId === "string" &&
    typeof candidate.artifactHash === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.input === "object" &&
    candidate.input !== null &&
    Array.isArray(candidate.sections) &&
    typeof candidate.dependencyManifest === "object" &&
    candidate.dependencyManifest !== null &&
    Array.isArray(candidate.dependencyManifest.dependencies) &&
    Array.isArray(candidate.warnings) &&
    Array.isArray(candidate.unsafeReasons)
  );
}
