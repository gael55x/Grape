import type {
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../../../../shared/index.js";
import { displayRetrievalConfidenceState } from "../../../../../shared/index.js";
import { TRUST_WORDING_DISCLAIMERS } from "../../../../../shared/trust-wording.js";
import { repositoryContextSection } from "../factory.js";
import { dependencyIdForRef, sectionDependencyRefs, sourceAndPackageContextDependencyRefs } from "../dependencies.js";
import type { CompileRepositoryContextArtifactInput } from "../../types.js";

export function taskRetrievalSection(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape | undefined {
  const retrieval = input.taskRetrieval;
  if (!retrieval) return undefined;
  if (
    retrieval.selectedSourceRefs.length === 0 &&
    retrieval.relatedTestRelationships.length === 0 &&
    retrieval.queryTerms.length === 0 &&
    retrieval.semanticCandidates.length === 0 &&
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
      [
        ...sourceAndPackageContextDependencyRefs(retrieval.selectedSourceRefs, dependencies),
        ...retrieval.relatedTestRelationships
          .map((relationship) => relationship.relationshipRef)
          .filter((ref): ref is string => Boolean(ref))
          .map((relationshipRef) => dependencyIdForRef(relationshipRef, dependencies))
      ].filter((ref): ref is string => Boolean(ref))
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
    `Retrieval confidence: ${displayRetrievalConfidenceState(retrieval.confidence?.state ?? "partial")}`,
    "Confidence reasons:",
    ...listOrNone(retrieval.confidence?.reasons ?? ["no_task_selection_evidence"]),
    "Selected source refs:",
    ...listOrNone(retrieval.selectedSourceRefs),
    "Retrieval-priority source refs (same as selected; advisory only; not proof):",
    ...listOrNone(retrieval.rankedSourceRefs),
    TRUST_WORDING_DISCLAIMERS.semanticCandidateSectionHeader,
    ...semanticCandidateListOrNone(retrieval.semanticCandidates),
    "Explicit seed refs:",
    ...listOrNone(retrieval.explicitSourceRefs),
    "Test seed refs:",
    ...listOrNone(retrieval.testSourceRefs),
    "Related test refs:",
    ...listOrNone(retrieval.relatedTestSourceRefs),
    "Related test relationships (selection evidence only; not test execution or correctness proof):",
    ...relationshipListOrNone(retrieval.relatedTestRelationships),
    "Graph-expanded refs:",
    ...listOrNone(retrieval.graphSourceRefs),
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

function semanticCandidateListOrNone(
  candidates: NonNullable<CompileRepositoryContextArtifactInput["taskRetrieval"]>["semanticCandidates"]
): readonly string[] {
  return candidates.length > 0
    ? candidates.map(
        (candidate) =>
          `- ${candidate.sourceRef} score=${candidate.score} signals=[${candidate.matchedSignals.join(", ")}] (${candidate.advisoryLabel})`
      )
    : ["- none"];
}

function relationshipListOrNone(
  relationships: NonNullable<CompileRepositoryContextArtifactInput["taskRetrieval"]>["relatedTestRelationships"]
): readonly string[] {
  return relationships.length > 0
    ? relationships.map(
        (relationship) =>
          [
            `- ${relationship.testSourceRef} ${relationship.relationship} ${relationship.targetSourceRef}`,
            relationship.relationshipRef ? ` (relationshipRef: ${relationship.relationshipRef})` : ""
          ].join("")
      )
    : ["- none"];
}

function anchorListOrNone(
  anchors: NonNullable<CompileRepositoryContextArtifactInput["taskRetrieval"]>["sourceAnchors"]
): readonly string[] {
  return anchors && anchors.length > 0
    ? anchors.map((anchor) => `- ${anchor.sourceRef}:${anchor.startLine}-${anchor.endLine} (${anchor.label})`)
    : ["- none"];
}
