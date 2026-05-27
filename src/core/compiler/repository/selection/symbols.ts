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
  return orderByPreferredPath([...nodes], preferredSourceRefs).slice(0, maxListedSymbols);
}

export function selectedSymbolEdges(
  edges: readonly RepositoryArtifactSymbolEdgeInput[]
): readonly RepositoryArtifactSymbolEdgeInput[] {
  return [...edges]
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId))
    .slice(0, maxListedEdges);
}
