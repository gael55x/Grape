import type { SourceType } from "../../shared/index.js";
import type {
  RepositoryArtifactSourceInput,
  RepositoryArtifactSymbolEdgeInput,
  RepositoryArtifactSymbolNodeInput
} from "./repository-context-types.js";

export const maxListedSources = 50;
export const maxListedSymbols = 50;
export const maxListedEdges = 50;

export function selectedSources(
  sources: readonly RepositoryArtifactSourceInput[]
): readonly RepositoryArtifactSourceInput[] {
  return [...sources]
    .filter((source) => source.privacyStatus === "allowed" && source.redactionStatus !== "blocked")
    .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef))
    .slice(0, maxListedSources);
}

export function selectedSymbolNodes(
  nodes: readonly RepositoryArtifactSymbolNodeInput[]
): readonly RepositoryArtifactSymbolNodeInput[] {
  return [...nodes]
    .sort((left, right) => `${left.path}:${left.name}`.localeCompare(`${right.path}:${right.name}`))
    .slice(0, maxListedSymbols);
}

export function selectedSymbolEdges(
  edges: readonly RepositoryArtifactSymbolEdgeInput[]
): readonly RepositoryArtifactSymbolEdgeInput[] {
  return [...edges]
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId))
    .slice(0, maxListedEdges);
}

export function sourceTypeCounts(sources: readonly RepositoryArtifactSourceInput[]): Map<SourceType, number> {
  const counts = new Map<SourceType, number>();
  for (const source of sources) {
    counts.set(source.sourceType, (counts.get(source.sourceType) ?? 0) + 1);
  }
  return new Map([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}
