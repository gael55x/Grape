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
      endLine: node.endLine
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
): Array<{ sourceRef: string; targetSourceRef: string; relationship: "imports" }> {
  const modulePathBySymbolId = new Map(
    symbolNodes
      .filter((node) => node.symbolKind === "module")
      .map((node) => [node.symbolId, node.path])
  );
  const relationships: Array<{ sourceRef: string; targetSourceRef: string; relationship: "imports" }> = [];

  for (const edge of symbolEdges) {
    if (edge.edgeType !== "imports") continue;
    const sourceRef = modulePathBySymbolId.get(edge.fromSymbolId);
    const targetSourceRef = edge.toSymbolId ? modulePathBySymbolId.get(edge.toSymbolId) : edge.toRef;
    if (!sourceRef || !targetSourceRef) continue;
    relationships.push({ sourceRef, targetSourceRef, relationship: "imports" });
  }

  return relationships;
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
