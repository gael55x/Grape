import type {
  InMemoryContextArtifactShape,
  InMemoryContextDependencyManifestShape,
  InMemoryContextDependencyShape,
  InMemoryContextRequest,
  InMemoryContextSectionShape
} from "../../../../shared/index.js";
import { hashStableJson, hashStableParts } from "../hash.js";

export interface RepositoryContextArtifactIntegrityInput {
  readonly artifact: InMemoryContextArtifactShape;
  readonly snapshotId: string;
  readonly expectedArtifactHash: string;
  readonly expectedDependencyManifestHash: string;
}

export interface RepositoryContextArtifactHashInput {
  readonly input: InMemoryContextRequest;
  readonly sections: readonly InMemoryContextSectionShape[];
  readonly dependencyManifest: Pick<
    InMemoryContextDependencyManifestShape,
    "dependencies" | "hashAlgorithm" | "manifestHash"
  >;
}

export function assertRepositoryContextArtifactIntegrity(
  input: RepositoryContextArtifactIntegrityInput
): void {
  for (const section of input.artifact.sections) {
    if (section.redactionStatus === "blocked") {
      throw new Error(`context section ${section.id} has blocked redaction status`);
    }

    const sectionHash = repositoryContextSectionHash(section);
    if (section.contentHash !== sectionHash) {
      throw new Error(`context section ${section.id} content hash does not match actual body`);
    }
  }

  const manifestHash = repositoryContextManifestHash({
    dependencies: input.artifact.dependencyManifest.dependencies,
    snapshotId: input.snapshotId,
    worktreeStateId: requireWorktreeStateId(input.artifact.dependencyManifest.dependencies)
  });
  if (input.artifact.dependencyManifest.manifestHash !== manifestHash) {
    throw new Error("context artifact dependency manifest hash does not match actual dependencies");
  }
  if (input.expectedDependencyManifestHash !== manifestHash) {
    throw new Error("context artifact dependency manifest hash does not match stored metadata");
  }

  const artifactHash = repositoryContextArtifactHash(input.artifact);
  if (input.artifact.artifactHash !== artifactHash) {
    throw new Error("context artifact hash does not match actual artifact contents");
  }
  if (input.expectedArtifactHash !== artifactHash) {
    throw new Error("context artifact hash does not match stored metadata");
  }
}

export function repositoryContextSectionHash(section: InMemoryContextSectionShape): string {
  return hashStableParts([section.id, section.title, section.body, ...section.dependencyRefs]);
}

export function repositoryContextManifestHash(input: {
  readonly dependencies: readonly InMemoryContextDependencyShape[];
  readonly snapshotId: string;
  readonly worktreeStateId: string;
}): string {
  return hashStableJson({
    dependencies: input.dependencies,
    snapshotId: input.snapshotId,
    worktreeStateId: input.worktreeStateId
  });
}

export function repositoryContextArtifactHash(input: RepositoryContextArtifactHashInput): string {
  return hashStableJson({
    input: input.input,
    sections: input.sections,
    dependencyManifest: {
      dependencies: input.dependencyManifest.dependencies,
      hashAlgorithm: input.dependencyManifest.hashAlgorithm,
      manifestHash: input.dependencyManifest.manifestHash
    }
  });
}

function requireWorktreeStateId(dependencies: readonly InMemoryContextDependencyShape[]): string {
  const dependency = dependencies.find((candidate) => candidate.id === "worktree-state");
  if (!dependency) throw new Error("context artifact dependency manifest is missing worktree-state");
  return dependency.ref;
}
