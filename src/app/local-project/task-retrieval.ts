import {
  resolveTaskSourceRetrieval,
  taskRetrievalTerms,
  type TaskRetrievalFtsMatch
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

const ftsMatchesPerTerm = 8;

export function resolveLocalTaskRetrieval(
  input: ResolveLocalTaskRetrievalInput
): RepositoryArtifactTaskRetrievalInput {
  const terms = taskRetrievalTerms({
    task: input.task,
    symbols: input.seedSymbols,
    tests: input.seedTests
  });
  const ftsMatches = terms.flatMap((term) => searchFtsTerm(input.indexingRepositories, input.snapshotId, term));

  return resolveTaskSourceRetrieval({
    task: input.task,
    sources: input.sources,
    symbols: input.symbolNodes.map((node) => ({
      sourceId: node.sourceId,
      path: node.path,
      name: node.name
    })),
    ftsMatches,
    seedFiles: input.seedFiles,
    seedSymbols: input.seedSymbols,
    seedTests: input.seedTests
  });
}

function searchFtsTerm(
  repositories: IndexingStorageRepositories,
  snapshotId: string,
  term: string
): readonly TaskRetrievalFtsMatch[] {
  return repositories.ftsEntries.searchSnapshot(snapshotId, term, ftsMatchesPerTerm).map((entry) => ({
    sourceId: entry.sourceId,
    sourceRef: entry.sourceRef,
    matchedTerm: term
  }));
}
