import type {
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../../../shared/index.js";
import { compressionDependencyId } from "../dependencies.js";
import { repositoryContextSection as section } from "./factory.js";
import type { CompileRepositoryContextArtifactInput } from "../types.js";

export function compressionArtifactsSection(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape | undefined {
  const artifacts = input.compressionArtifacts ?? [];
  if (artifacts.length === 0) return undefined;

  return section({
    id: "compression-orientation",
    type: "compression_orientation",
    title: "Deterministic Compression Cache",
    body: artifacts
      .map((artifact) =>
        [
          `Compression artifact: ${artifact.compressionId}`,
          `Type: ${artifact.type}`,
          `Input hash: ${artifact.inputHash}`,
          `Output hash: ${artifact.outputHash}`,
          artifact.summaryText
        ].join("\n")
      )
      .join("\n\n"),
    dependencyRefs: compressionDependencyRefs(artifacts, dependencies),
    pinned: false,
    exactRequired: false
  });
}

function compressionDependencyRefs(
  artifacts: NonNullable<CompileRepositoryContextArtifactInput["compressionArtifacts"]>,
  dependencies: readonly InMemoryContextDependencyShape[]
): string[] {
  const dependencyIds = new Set(dependencies.map((dependency) => dependency.id));
  return artifacts
    .map((artifact) => compressionDependencyId(artifact.compressionId))
    .filter((dependencyRef) => dependencyIds.has(dependencyRef));
}
