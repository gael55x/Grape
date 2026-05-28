import {
  resolveTaskSourceRetrieval,
  taskRetrievalTerms,
  type TaskRetrievalLexicalMatch
} from "../../core/retrieval/index.js";
import type { IndexingStorageRepositories } from "../../core/storage/index.js";
import type {
  RepositoryArtifactSourceInput,
  RepositoryArtifactSymbolNodeInput,
  RepositoryArtifactTaskRetrievalInput
} from "../../core/compiler/index.js";

export interface ResolveLocalTaskRetrievalInput {
  readonly task: string;
  readonly snapshotId: string;
  readonly sources: readonly RepositoryArtifactSourceInput[];
  readonly symbolNodes: readonly RepositoryArtifactSymbolNodeInput[];
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
    seedFiles: input.seedFiles,
    seedSymbols: input.seedSymbols,
    seedTests: input.seedTests
  });
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
