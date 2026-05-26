import type {
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../shared/index.js";
import { hashStableParts } from "./repository-context-hash.js";
import {
  selectedSources,
  selectedSymbolEdges,
  selectedSymbolNodes,
  sourceTypeCounts
} from "./repository-context-selection.js";
import type { CompileRepositoryContextArtifactInput } from "./repository-context-types.js";

export function contextSections(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape[] {
  return [
    taskSection(input),
    repoStateSection(input),
    sourceManifestSection(input, dependencies),
    symbolSummarySection(input, dependencies),
    blindSpotSection(input)
  ];
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
  const sources = selectedSources(input.sources);
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
  const nodes = selectedSymbolNodes(input.symbolNodes);
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

function sectionDependencyRefs(
  requiredRefs: readonly string[],
  scopedRefs: readonly string[]
): string[] {
  return [...new Set([...requiredRefs, ...scopedRefs])];
}

function relationshipTarget(edge: { readonly toRef?: string; readonly toSymbolId?: string }): string {
  if (edge.toRef && edge.toSymbolId) return `${edge.toRef} (${edge.toSymbolId})`;
  return edge.toRef ?? edge.toSymbolId ?? "unresolved";
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

function section(
  input: Omit<InMemoryContextSectionShape, "contentHash" | "redactionStatus" | "proofRefs" | "sourceRefs"> & {
    readonly sourceRefs?: readonly string[];
    readonly proofRefs?: readonly string[];
  }
): InMemoryContextSectionShape {
  return {
    ...input,
    sourceRefs: [...(input.sourceRefs ?? [])],
    proofRefs: [...(input.proofRefs ?? [])],
    contentHash: hashStableParts([input.id, input.title, input.body, ...input.dependencyRefs]),
    redactionStatus: "clean"
  };
}
