import type {
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../../../../shared/index.js";
import { repositoryContextSection } from "../factory.js";
import { sectionDependencyRefs, sourceDependencyRefForSourceRef } from "../dependencies.js";
import type { CompileRepositoryContextArtifactInput } from "../../types.js";

export function taskRetrievalSection(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape | undefined {
  const retrieval = input.taskRetrieval;
  if (!retrieval) return undefined;
  if (
    retrieval.selectedSourceRefs.length === 0 &&
    retrieval.queryTerms.length === 0 &&
    retrieval.warnings.length === 0
  ) {
    return undefined;
  }

  return repositoryContextSection({
    id: "task-retrieval",
    type: "task",
    title: "Task Retrieval Inputs",
    body: taskRetrievalBody(retrieval),
    sourceRefs: retrieval.selectedSourceRefs,
    dependencyRefs: sectionDependencyRefs(
      ["repo-snapshot", "worktree-state"],
      retrieval.selectedSourceRefs
        .map((sourceRef) => sourceDependencyRefForSourceRef(sourceRef, dependencies))
        .filter((ref): ref is string => Boolean(ref))
    ),
    pinned: false,
    exactRequired: false
  });
}

function taskRetrievalBody(
  retrieval: NonNullable<CompileRepositoryContextArtifactInput["taskRetrieval"]>
): string {
  return [
    `Query terms: ${retrieval.queryTerms.length > 0 ? retrieval.queryTerms.join(", ") : "none"}`,
    "Selected source refs:",
    ...listOrNone(retrieval.selectedSourceRefs),
    "Explicit seed refs:",
    ...listOrNone(retrieval.explicitSourceRefs),
    "Test seed refs:",
    ...listOrNone(retrieval.testSourceRefs),
    "Related test refs:",
    ...listOrNone(retrieval.relatedTestSourceRefs),
    "Symbol-matched refs:",
    ...listOrNone(retrieval.symbolSourceRefs),
    "Exact source anchors:",
    ...anchorListOrNone(retrieval.sourceAnchors ?? []),
    "Lexical-matched refs:",
    ...listOrNone(retrieval.lexicalSourceRefs),
    retrieval.warnings.length > 0 ? `Warnings: ${retrieval.warnings.join(", ")}` : "Warnings: none"
  ].join("\n");
}

function listOrNone(values: readonly string[]): readonly string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- none"];
}

function anchorListOrNone(
  anchors: NonNullable<CompileRepositoryContextArtifactInput["taskRetrieval"]>["sourceAnchors"]
): readonly string[] {
  return anchors && anchors.length > 0
    ? anchors.map((anchor) => `- ${anchor.sourceRef}:${anchor.startLine}-${anchor.endLine} (${anchor.label})`)
    : ["- none"];
}
