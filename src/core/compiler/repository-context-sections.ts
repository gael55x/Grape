import type {
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../shared/index.js";
import { repositoryContextSection as section } from "./repository-context-section-factory.js";
import {
  selectedRuleSourceExcerpts,
  selectedSources,
  selectedSourceExcerpts,
  selectedSymbolEdges,
  selectedSymbolNodes,
  sourceTypeCounts
} from "./repository-context-selection.js";
import { sourceProofDependencyId, sourceProofRefs } from "./repository-source-proofs.js";
import { taskRetrievalSection } from "./repository-context-task-retrieval-section.js";
import type { CompileRepositoryContextArtifactInput } from "./repository-context-types.js";

export function contextSections(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape[] {
  return compactSections([
    taskSection(input),
    taskRetrievalSection(input, dependencies),
    repoStateSection(input),
    sourceManifestSection(input, dependencies),
    activeProjectRulesSection(input, dependencies),
    exactSourceEvidenceSection(input, dependencies),
    symbolSummarySection(input, dependencies),
    blindSpotSection(input)
  ]);
}

function taskSection(input: CompileRepositoryContextArtifactInput): InMemoryContextSectionShape {
  return section({
    id: "task",
    type: "task",
    title: "Task Context",
    body: [
      `Task type: ${input.taskType}`,
      `Task id: ${input.taskId}`,
      `Risk overlays: ${input.riskOverlays.length > 0 ? input.riskOverlays.join(", ") : "none"}`
    ].join("\n"),
    dependencyRefs: ["repo-snapshot"],
    pinned: false,
    exactRequired: false
  });
}

function repoStateSection(input: CompileRepositoryContextArtifactInput): InMemoryContextSectionShape {
  return section({
    id: "repo-state",
    type: "risk_warning",
    title: "Repository State",
    body: [
      `Branch: ${input.snapshot.branch}`,
      `Commit: ${input.snapshot.commit}`,
      `Worktree: ${input.snapshot.worktreeStatus}`,
      `Dirty paths: ${input.snapshot.dirtyPaths.length}`,
      ...input.snapshot.dirtyPaths.slice(0, 20).map((repoPath) => `- ${repoPath}`)
    ].join("\n"),
    dependencyRefs: ["repo-snapshot", "worktree-state"],
    pinned: true,
    exactRequired: false
  });
}

function sourceManifestSection(
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

function symbolSummarySection(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape {
  const nodes = selectedSymbolNodes(input.symbolNodes, preferredSourceRefs(input));
  const edges = selectedSymbolEdges(input.symbolEdges);
  return section({
    id: "symbol-summary",
    type: "compression_orientation",
    title: "File Relationship Index",
    body: [
      `Indexed symbol nodes: ${input.symbolNodes.length}`,
      `Indexed symbol edges: ${input.symbolEdges.length}`,
      "Selected nodes:",
      ...nodes.map((node) => `- ${node.path} :: ${node.name} [${node.symbolKind}, ${node.confidence}]`),
      "Selected relationships:",
      ...edges.map((edge) => `- ${edge.edgeType}: ${edge.fromSymbolId} -> ${relationshipTarget(edge)}`)
    ].join("\n"),
    dependencyRefs: sectionDependencyRefs(
      ["repo-snapshot", "worktree-state"],
      dependencies.filter((dependency) => dependency.id.startsWith("symbol:")).map((dependency) => dependency.id)
    ),
    pinned: false,
    exactRequired: false
  });
}

function exactSourceEvidenceSection(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape {
  const excerpts = selectedSourceExcerpts(input.sourceExcerpts, preferredSourceRefs(input));
  return section({
    id: "exact-source-evidence",
    type: "code_span",
    title: "Exact Source Evidence",
    body: exactSourceEvidenceBody(excerpts),
    sourceRefs: excerpts.map((excerpt) => excerpt.sourceRef),
    proofRefs: sourceProofRefs(excerpts),
    dependencyRefs: sectionDependencyRefs(
      ["repo-snapshot", "worktree-state"],
      [
        ...excerpts.map((excerpt) => sourceDependencyRefForSourceRef(excerpt.sourceRef, dependencies)),
        ...excerpts.map((excerpt) => sourceProofDependencyId(excerpt.proofId))
      ].filter((ref): ref is string => Boolean(ref))
    ),
    pinned: false,
    exactRequired: excerpts.length > 0
  });
}

function activeProjectRulesSection(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape | undefined {
  const ruleExcerpts = selectedRuleSourceExcerpts(input.sourceExcerpts);
  if (ruleExcerpts.length === 0) return undefined;

  return section({
    id: "active-project-rules",
    type: "pinned_rule",
    title: "Active Project Rules",
    body: activeProjectRulesBody(ruleExcerpts),
    sourceRefs: ruleExcerpts.map((excerpt) => excerpt.sourceRef),
    proofRefs: sourceProofRefs(ruleExcerpts),
    dependencyRefs: sectionDependencyRefs(
      ["repo-snapshot", "worktree-state"],
      [
        ...ruleExcerpts.map((excerpt) => sourceDependencyRefForSourceRef(excerpt.sourceRef, dependencies)),
        ...ruleExcerpts.map((excerpt) => sourceProofDependencyId(excerpt.proofId))
      ].filter((ref): ref is string => Boolean(ref))
    ),
    pinned: true,
    exactRequired: true
  });
}

function activeProjectRulesBody(
  excerpts: ReturnType<typeof selectedRuleSourceExcerpts>
): string {
  return excerpts
    .map((excerpt) =>
      [
        `Rule source: ${excerpt.sourceRef}`,
        `Scope: ${excerpt.sourceScope}`,
        `Proof: ${excerpt.proofId}`,
        `Source hash: ${excerpt.sourceHash}`,
        `Excerpt hash: ${excerpt.excerptHash}`,
        "```",
        excerpt.excerpt,
        "```"
      ].join("\n")
    )
    .join("\n\n");
}

function exactSourceEvidenceBody(
  excerpts: ReturnType<typeof selectedSourceExcerpts>
): string {
  if (excerpts.length === 0) {
    return [
      "No exact source excerpts were selected for this scaffold artifact.",
      "Use source manifest and relationship sections for orientation only."
    ].join("\n");
  }

  return excerpts
    .map((excerpt) =>
      [
        `Source: ${excerpt.sourceRef}`,
        `Type: ${excerpt.sourceType}`,
        `Scope: ${excerpt.sourceScope}`,
        `Lines: ${excerpt.startLine}-${excerpt.endLine}${excerpt.truncated ? " (truncated)" : ""}`,
        `Proof: ${excerpt.proofId}`,
        `Source hash: ${excerpt.sourceHash}`,
        `Excerpt hash: ${excerpt.excerptHash}`,
        "```",
        excerpt.excerpt,
        "```"
      ].join("\n")
    )
    .join("\n\n");
}

function preferredSourceRefs(input: CompileRepositoryContextArtifactInput): readonly string[] {
  return input.taskRetrieval?.selectedSourceRefs ?? [];
}

function sectionDependencyRefs(
  requiredRefs: readonly string[],
  scopedRefs: readonly string[]
): string[] {
  return [...new Set([...requiredRefs, ...scopedRefs])];
}

function sourceDependencyRefForSourceRef(
  sourceRef: string,
  dependencies: readonly InMemoryContextDependencyShape[]
): string | undefined {
  return dependencies.find((dependency) => dependency.ref === sourceRef)?.id;
}

function relationshipTarget(edge: { readonly toRef?: string; readonly toSymbolId?: string }): string {
  if (edge.toRef && edge.toSymbolId) return `${edge.toRef} (${edge.toSymbolId})`;
  return edge.toRef ?? edge.toSymbolId ?? "unresolved";
}

function compactSections(
  sections: readonly (InMemoryContextSectionShape | undefined)[]
): InMemoryContextSectionShape[] {
  return sections.filter((section): section is InMemoryContextSectionShape => section !== undefined);
}

function blindSpotSection(input: CompileRepositoryContextArtifactInput): InMemoryContextSectionShape {
  return section({
    id: "index-blind-spots",
    type: "stale_warning",
    title: "Index Confidence",
    body: [
      "This artifact uses the V1 lightweight file index.",
      "It is an impact candidate set, not a complete call graph.",
      "Regex import/symbol extraction can miss dynamic imports, framework routing, dependency injection, and generated code.",
      "No durable claims are promoted from this artifact without proof validation."
    ].join("\n"),
    dependencyRefs: ["repo-snapshot", "worktree-state"],
    pinned: input.taskType === "refactor" || input.riskOverlays.length > 0,
    exactRequired: false
  });
}
