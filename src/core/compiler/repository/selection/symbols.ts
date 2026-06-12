import type {
  RepositoryArtifactSymbolEdgeInput,
  RepositoryArtifactSymbolNodeInput
} from "../types.js";
import { maxListedEdges, maxListedSymbols } from "./limits.js";
import { orderByPreferredPath } from "./order.js";

export function selectedSymbolNodes(
  nodes: readonly RepositoryArtifactSymbolNodeInput[],
  preferredSourceRefs: readonly string[] = []
): readonly RepositoryArtifactSymbolNodeInput[] {
  const ordered = orderByPreferredPath([...nodes], preferredSourceRefs);
  if (preferredSourceRefs.length === 0) return ordered.slice(0, maxListedSymbols);

  const preferred = new Set(preferredSourceRefs);
  return ordered
    .filter((node) => preferred.has(node.path))
    .slice(0, maxListedSymbols);
}

export function selectedSymbolEdges(
  edges: readonly RepositoryArtifactSymbolEdgeInput[],
  selectedSymbolIds: ReadonlySet<string> = new Set()
): readonly RepositoryArtifactSymbolEdgeInput[] {
  const candidates = selectedSymbolIds.size > 0
    ? edges.filter((edge) =>
        selectedSymbolIds.has(edge.fromSymbolId) || (edge.toSymbolId ? selectedSymbolIds.has(edge.toSymbolId) : false)
      )
    : edges;
  return [...candidates]
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId))
    .slice(0, maxListedEdges);
}
