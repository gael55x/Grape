import type {
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../../../../shared/index.js";
import { repositoryContextSection as section } from "../factory.js";
import { sectionDependencyRefs } from "../dependencies.js";
import { preferredSourceRefs } from "../task-selection.js";
import { selectedSources, sourceTypeCounts } from "../../selection/index.js";
import type { CompileRepositoryContextArtifactInput } from "../../types.js";

export function sourceManifestSection(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape {
  const sources = selectedSources(input.sources, preferredSourceRefs(input));
  const counts = sourceTypeCounts(input.sources);
  return section({
    id: "source-manifest",
    type: "compression_orientation",
    title: "Allowed Source Manifest",
    body: [
      `Allowed source records: ${input.sources.length}`,
      ...[...counts.entries()].map(([sourceType, count]) => `- ${sourceType}: ${count}`),
      "Selected source refs:",
      ...sources.map((source) => `- ${source.sourceRef} (${source.sourceType}, ${source.sourceScope})`)
    ].join("\n"),
    sourceRefs: sources.map((source) => source.sourceRef),
    dependencyRefs: sectionDependencyRefs(
      ["repo-snapshot", "worktree-state"],
      dependencies.filter((dependency) => dependency.id.startsWith("source:")).map((dependency) => dependency.id)
    ),
    pinned: false,
    exactRequired: false
  });
}
