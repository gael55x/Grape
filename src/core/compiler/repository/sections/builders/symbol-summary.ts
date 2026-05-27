import type {
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../../../../shared/index.js";
import { repositoryContextSection as section } from "../factory.js";
import { sectionDependencyRefs } from "../dependencies.js";
import { preferredSourceRefs } from "../task-selection.js";
import { selectedSymbolEdges, selectedSymbolNodes } from "../../selection/index.js";
import type { CompileRepositoryContextArtifactInput } from "../../types.js";

export function symbolSummarySection(
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

function relationshipTarget(edge: { readonly toRef?: string; readonly toSymbolId?: string }): string {
  if (edge.toRef && edge.toSymbolId) return `${edge.toRef} (${edge.toSymbolId})`;
  return edge.toRef ?? edge.toSymbolId ?? "unresolved";
}
