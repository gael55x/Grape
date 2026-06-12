import {
  resolveTaskSourceRetrieval,
  taskRetrievalTerms,
  type TaskRetrievalLexicalMatch
} from "../../../core/retrieval/index.js";
import type { IndexingStorageRepositories } from "../../../core/storage/index.js";
import type {
  RepositoryArtifactSourceInput,
  RepositoryArtifactSymbolEdgeInput,
  RepositoryArtifactSymbolNodeInput,
  RepositoryArtifactTaskRetrievalInput
} from "../../../core/compiler/index.js";

export interface ResolveLocalTaskRetrievalInput {
  readonly task: string;
  readonly snapshotId: string;
  readonly sources: readonly RepositoryArtifactSourceInput[];
  readonly symbolNodes: readonly RepositoryArtifactSymbolNodeInput[];
  readonly symbolEdges: readonly RepositoryArtifactSymbolEdgeInput[];
  readonly indexingRepositories: IndexingStorageRepositories;
  readonly seedFiles?: readonly string[];
  readonly seedSymbols?: readonly string[];
  readonly seedTests?: readonly string[];
}

const lexicalMatchesPerTerm = 8;

export function resolveLocalTaskRetrieval(
  input: ResolveLocalTaskRetrievalInput
): RepositoryArtifactTaskRetrievalInput {
  const terms = taskRetrievalTerms({
    task: input.task,
    symbols: input.seedSymbols,
    tests: input.seedTests
  });
  const lexicalMatches = terms.flatMap((term) =>
    searchLexicalTerm(input.indexingRepositories, input.snapshotId, term)
  );

  return resolveTaskSourceRetrieval({
    task: input.task,
    sources: input.sources,
    symbols: input.symbolNodes.map((node) => ({
      sourceId: node.sourceId,
      path: node.path,
      name: node.name,
      symbolKind: node.symbolKind,
      startLine: node.startLine,
      endLine: node.endLine,
      packageRoot: packageRootFromSymbolMetadata(node.metadataJson),
      language: node.language
    })),
    lexicalMatches,
    relationships: importRelationships(input.symbolNodes, input.symbolEdges),
    seedFiles: input.seedFiles,
    seedSymbols: input.seedSymbols,
    seedTests: input.seedTests
  });
}

function importRelationships(
  symbolNodes: readonly RepositoryArtifactSymbolNodeInput[],
  symbolEdges: readonly RepositoryArtifactSymbolEdgeInput[]
): Array<{
  relationshipRef: string;
  sourceRef: string;
  targetSourceRef: string;
  relationship: "imports" | "calls";
}> {
  const pathBySymbolId = new Map(symbolNodes.map((node) => [node.symbolId, node.path]));
  const relationships: Array<{
    relationshipRef: string;
    sourceRef: string;
    targetSourceRef: string;
    relationship: "imports" | "calls";
  }> = [];

  for (const edge of symbolEdges) {
    if (edge.edgeType !== "imports" && edge.edgeType !== "calls") continue;
    const sourceRef = pathBySymbolId.get(edge.fromSymbolId);
    const targetSourceRef = edge.toSymbolId ? pathBySymbolId.get(edge.toSymbolId) : edge.toRef;
    if (!sourceRef || !targetSourceRef) continue;
    relationships.push({ relationshipRef: edge.edgeId, sourceRef, targetSourceRef, relationship: edge.edgeType });
  }

  return relationships;
}

function packageRootFromSymbolMetadata(metadataJson: string | undefined): string | undefined {
  const metadata = parseObjectJson(metadataJson);
  const packageRoot = stringField(metadata, "packageRoot") ?? stringField(metadata, "manifestPackageRoot");
  return packageRoot && packageRoot !== "." ? packageRoot : undefined;
}

function parseObjectJson(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function stringField(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function searchLexicalTerm(
  repositories: IndexingStorageRepositories,
  snapshotId: string,
  term: string
): readonly TaskRetrievalLexicalMatch[] {
  return repositories.ftsEntries.searchSnapshot(snapshotId, term, lexicalMatchesPerTerm).map((entry) => ({
    sourceId: entry.sourceId,
    sourceRef: entry.sourceRef,
    matchedTerm: term
  }));
}
