import type { DatabaseSync } from "node:sqlite";

import { persistSourceProofs } from "../persist-source-proofs.js";
import type {
  RepositoryArtifactSourceExcerptInput,
  RepositoryArtifactTaskRetrievalInput
} from "../../core/compiler/index.js";
import type {
  ProofStorageRepositories,
  SourceRecord
} from "../../core/storage/index.js";
import { runStorageTransaction } from "../../core/storage/index.js";
import { readLocalSourceExcerpts } from "./source-excerpts/index.js";

export interface PrepareLocalCompileProofsInput {
  readonly database: DatabaseSync;
  readonly proofRepositories: ProofStorageRepositories;
  readonly rootPath: string;
  readonly sources: readonly SourceRecord[];
  readonly taskRetrieval: RepositoryArtifactTaskRetrievalInput;
  readonly now: string;
}

export interface PrepareLocalCompileProofsResult {
  readonly sourceExcerpts: readonly RepositoryArtifactSourceExcerptInput[];
  readonly taskRetrieval: RepositoryArtifactTaskRetrievalInput;
}

export function prepareLocalCompileProofs(
  input: PrepareLocalCompileProofsInput
): PrepareLocalCompileProofsResult {
  const sourceExcerpts = readLocalSourceExcerpts({
    rootPath: input.rootPath,
    sources: input.sources,
    preferredSourceRefs: input.taskRetrieval.selectedSourceRefs,
    queryTerms: input.taskRetrieval.queryTerms
  });
  const persistedProofs = runStorageTransaction(input.database, () =>
    persistSourceProofs({
      repositories: input.proofRepositories,
      sources: input.sources,
      sourceExcerpts,
      now: input.now
    })
  );

  return {
    sourceExcerpts: persistedProofs.acceptedSourceExcerpts,
    taskRetrieval: appendProofWarnings(input.taskRetrieval, persistedProofs.rejectedProofs.length)
  };
}

function appendProofWarnings(
  taskRetrieval: RepositoryArtifactTaskRetrievalInput,
  rejectedProofCount: number
): RepositoryArtifactTaskRetrievalInput {
  if (rejectedProofCount === 0) return taskRetrieval;

  return {
    ...taskRetrieval,
    warnings: [
      ...taskRetrieval.warnings,
      `exact_source_proofs_rejected:${rejectedProofCount}`
    ]
  };
}
