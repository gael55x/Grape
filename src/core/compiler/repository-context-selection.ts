import type { SourceType } from "../../shared/index.js";
import type {
  RepositoryArtifactSourceInput,
  RepositoryArtifactSourceExcerptInput,
  RepositoryArtifactSymbolEdgeInput,
  RepositoryArtifactSymbolNodeInput
} from "./repository-context-types.js";

export const maxListedSources = 50;
export const maxListedSymbols = 50;
export const maxListedEdges = 50;
export const maxExactSourceExcerpts = 5;

export function selectedSources(
  sources: readonly RepositoryArtifactSourceInput[]
): readonly RepositoryArtifactSourceInput[] {
  return selectableSources(sources).slice(0, maxListedSources);
}

export function selectedExactSourceSources(
  sources: readonly RepositoryArtifactSourceInput[]
): readonly RepositoryArtifactSourceInput[] {
  return uniqueSources([
    ...selectedGenericExactSourceSources(sources),
    ...selectedRuleSources(sources)
  ]);
}

function selectedGenericExactSourceSources(
  sources: readonly RepositoryArtifactSourceInput[]
): readonly RepositoryArtifactSourceInput[] {
  return exactSourceCandidates(sources)
    .filter((source) => source.sourceType !== "rule_file")
    .slice(0, maxExactSourceExcerpts);
}

function selectedRuleSources(
  sources: readonly RepositoryArtifactSourceInput[]
): readonly RepositoryArtifactSourceInput[] {
  return exactSourceCandidates(sources)
    .filter((source) => source.sourceType === "rule_file")
    .slice(0, maxExactSourceExcerpts);
}

function exactSourceCandidates(
  sources: readonly RepositoryArtifactSourceInput[]
): readonly RepositoryArtifactSourceInput[] {
  return selectableSources(sources)
    .filter((source) => source.trustClass === "trusted")
    .filter((source) => sourceTypeCanSupportExactExcerpt(source.sourceType));
}

export function selectedSourceExcerpts(
  excerpts: readonly RepositoryArtifactSourceExcerptInput[]
): readonly RepositoryArtifactSourceExcerptInput[] {
  return [...excerpts]
    .filter((excerpt) => excerpt.sourceType !== "rule_file")
    .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef))
    .slice(0, maxExactSourceExcerpts);
}

export function selectedRuleSourceExcerpts(
  excerpts: readonly RepositoryArtifactSourceExcerptInput[]
): readonly RepositoryArtifactSourceExcerptInput[] {
  return [...excerpts]
    .filter((excerpt) => excerpt.sourceType === "rule_file")
    .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef))
    .slice(0, maxExactSourceExcerpts);
}

export function selectedProofSourceExcerpts(
  excerpts: readonly RepositoryArtifactSourceExcerptInput[]
): readonly RepositoryArtifactSourceExcerptInput[] {
  return uniqueExcerpts([
    ...selectedSourceExcerpts(excerpts),
    ...selectedRuleSourceExcerpts(excerpts)
  ]);
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

function sourceTypeCanSupportExactExcerpt(sourceType: SourceType): boolean {
  return (
    sourceType === "repository_file" ||
    sourceType === "rule_file" ||
    sourceType === "config_file" ||
    sourceType === "lockfile" ||
    sourceType === "migration_file"
  );
}

function selectableSources(
  sources: readonly RepositoryArtifactSourceInput[]
): readonly RepositoryArtifactSourceInput[] {
  return [...sources]
    .filter((source) => source.privacyStatus === "allowed" && source.redactionStatus !== "blocked")
    .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef));
}

function uniqueSources(
  sources: readonly RepositoryArtifactSourceInput[]
): readonly RepositoryArtifactSourceInput[] {
  const byId = new Map<string, RepositoryArtifactSourceInput>();
  for (const source of sources) {
    if (!byId.has(source.sourceId)) {
      byId.set(source.sourceId, source);
    }
  }
  return [...byId.values()];
}

function uniqueExcerpts(
  excerpts: readonly RepositoryArtifactSourceExcerptInput[]
): readonly RepositoryArtifactSourceExcerptInput[] {
  const byProofId = new Map<string, RepositoryArtifactSourceExcerptInput>();
  for (const excerpt of excerpts) {
    if (!byProofId.has(excerpt.proofId)) {
      byProofId.set(excerpt.proofId, excerpt);
    }
  }
  return [...byProofId.values()];
}
