import type {
  InMemoryContextArtifactShape,
  InMemoryContextDependencyManifestShape,
  InMemoryContextRequest,
  InMemoryContextSectionShape
} from "../../shared/index.js";

export interface InMemoryContextArtifactShapeInput {
  artifactId: string;
  input: InMemoryContextRequest;
  sections: InMemoryContextSectionShape[];
  dependencyManifest: InMemoryContextDependencyManifestShape;
  warnings?: string[];
  unsafeReasons?: string[];
  createdAt: string;
  artifactHash: string;
}

export function assertInMemoryContextArtifactShape(
  input: InMemoryContextArtifactShapeInput
): InMemoryContextArtifactShape {
  assertNonEmpty("artifactId", input.artifactId);
  assertNonEmpty("createdAt", input.createdAt);
  assertSha256Like("artifactHash", input.artifactHash);
  assertDependencyManifest(input.dependencyManifest);
  assertSections(input.sections, input.dependencyManifest);

  return {
    artifactId: input.artifactId,
    input: input.input,
    sections: input.sections,
    dependencyManifest: input.dependencyManifest,
    warnings: input.warnings ?? [],
    unsafeReasons: input.unsafeReasons ?? [],
    createdAt: input.createdAt,
    artifactHash: input.artifactHash
  };
}

function assertDependencyManifest(manifest: InMemoryContextDependencyManifestShape): void {
  assertNonEmpty("dependencyManifest.manifestId", manifest.manifestId);
  assertNonEmpty("dependencyManifest.createdAt", manifest.createdAt);
  assertSha256Like("dependencyManifest.manifestHash", manifest.manifestHash);

  if (manifest.hashAlgorithm !== "sha256") {
    throw new Error("Context artifact dependency manifest must use sha256.");
  }

  if (manifest.dependencies.length === 0) {
    throw new Error("Context artifact requires at least one dependency.");
  }

  for (const dependency of manifest.dependencies) {
    assertNonEmpty("dependency.id", dependency.id);
    assertNonEmpty("dependency.ref", dependency.ref);
    assertSha256Like("dependency.hash", dependency.hash);
  }
}

function assertSections(
  sections: InMemoryContextSectionShape[],
  manifest: InMemoryContextDependencyManifestShape
): void {
  if (sections.length === 0) {
    throw new Error("Context artifact requires at least one section.");
  }

  const dependencyIds = new Set(manifest.dependencies.map((dependency) => dependency.id));

  for (const section of sections) {
    assertNonEmpty("section.id", section.id);
    assertNonEmpty("section.title", section.title);
    assertNonEmpty("section.body", section.body);
    assertSha256Like("section.contentHash", section.contentHash);

    if (section.redactionStatus === "blocked") {
      throw new Error(`Context section ${section.id} has blocked redaction status.`);
    }

    if (section.dependencyRefs.length === 0) {
      throw new Error(`Context section ${section.id} requires dependency refs.`);
    }

    for (const dependencyRef of section.dependencyRefs) {
      if (!dependencyIds.has(dependencyRef)) {
        throw new Error(`Context section ${section.id} references unknown dependency ${dependencyRef}.`);
      }
    }

    if (section.exactRequired && section.sourceRefs.length === 0) {
      throw new Error(`Exact context section ${section.id} requires at least one source ref.`);
    }

    if (section.exactRequired && section.type === "active_claim" && section.proofRefs.length === 0) {
      throw new Error(`Exact active claim section ${section.id} requires at least one proof ref.`);
    }
  }
}

function assertNonEmpty(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must not be empty.`);
  }
}

function assertSha256Like(field: string, value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${field} must be a sha256 hex digest.`);
  }
}
