import { createGitRepoSnapshot } from "../../../core/git/index.js";
import {
  createEvidenceStorageRepositories,
  createProofStorageRepositories
} from "../../../core/storage/index.js";
import type {
  ProofRecord,
  SourceRecord
} from "../../../core/storage/index.js";
import { ensureConfiguredLocalProjectLayout } from "../setup/configured-layout.js";
import { withMigratedLocalDatabase } from "../setup/storage.js";
import type {
  ListLocalProofsInput,
  ListLocalProofsResult,
  LocalProofSummary
} from "../types.js";

export function listLocalProofs(input: ListLocalProofsInput): ListLocalProofsResult {
  const now = input.now ?? new Date().toISOString();
  const snapshot = createGitRepoSnapshot({
    rootPath: input.rootPath,
    createdAt: now,
    gitBinary: input.gitBinary
  });
  const { layout } = ensureConfiguredLocalProjectLayout(snapshot.rootPath);

  return withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database): ListLocalProofsResult {
      const proofRepositories = createProofStorageRepositories(database);
      const evidenceRepositories = createEvidenceStorageRepositories(database);
      const proofs = selectProofs(proofRepositories.proofs, input);
      const summaries = proofs.map((proof) => toProofSummary(proof, evidenceRepositories.sources.get(proof.sourceId)));
      if (input.proofId && summaries.length === 0) throw new Error(`proof was not found: ${input.proofId}`);
      return {
        rootPath: layout.rootPath,
        filter: {
          proofId: input.proofId,
          sourceId: input.sourceId
        },
        proofs: summaries
      };
    }
  }).value;
}

function selectProofs(
  repository: {
    readonly get: (proofId: string) => ProofRecord | undefined;
    readonly list: () => readonly ProofRecord[];
    readonly listBySource: (sourceId: string) => readonly ProofRecord[];
  },
  input: ListLocalProofsInput
): readonly ProofRecord[] {
  if (input.proofId) {
    const proof = repository.get(input.proofId);
    if (!proof) return [];
    if (input.sourceId && proof.sourceId !== input.sourceId) return [];
    return [proof];
  }

  return input.sourceId ? repository.listBySource(input.sourceId) : repository.list();
}

function toProofSummary(proof: ProofRecord, source: SourceRecord | undefined): LocalProofSummary {
  return {
    proofId: proof.proofId,
    claimId: proof.claimId,
    sourceId: proof.sourceId,
    sourceType: source?.sourceType,
    sourceRef: source?.sourceRef,
    sourceScope: source?.sourceScope,
    proofType: proof.proofType,
    sourceHash: proof.sourceHash,
    excerptHash: proof.excerptHash,
    supportStatus: proof.supportStatus,
    privacyStatus: source?.privacyStatus,
    redactionStatus: source?.redactionStatus,
    createdAt: proof.createdAt
  };
}
