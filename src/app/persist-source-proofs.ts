import { validateExactSourceProof } from "../core/proofs/index.js";
import type {
  ProofRecord,
  ProofStorageRepositories,
  SourceRecord
} from "../core/storage/index.js";
import type { RepositoryArtifactSourceExcerptInput } from "../core/compiler/index.js";

export interface PersistSourceProofsInput {
  readonly repositories: ProofStorageRepositories;
  readonly sources: readonly SourceRecord[];
  readonly sourceExcerpts: readonly RepositoryArtifactSourceExcerptInput[];
  readonly now: string;
}

export interface PersistSourceProofsResult {
  readonly proofsInserted: number;
  readonly proofsSeen: number;
  readonly rejectedProofs: readonly PersistSourceProofRejection[];
  readonly acceptedSourceExcerpts: readonly RepositoryArtifactSourceExcerptInput[];
}

export interface PersistSourceProofRejection {
  readonly proofId: string;
  readonly sourceId: string;
  readonly reason: string;
}

export function persistSourceProofs(input: PersistSourceProofsInput): PersistSourceProofsResult {
  const sourcesById = new Map(input.sources.map((source) => [source.sourceId, source]));
  const rejectedProofs: PersistSourceProofRejection[] = [];
  const acceptedSourceExcerpts: RepositoryArtifactSourceExcerptInput[] = [];
  let proofsInserted = 0;

  for (const excerpt of input.sourceExcerpts) {
    const source = sourcesById.get(excerpt.sourceId);
    const validation = validateExactSourceProof(
      {
        proofId: excerpt.proofId,
        sourceId: excerpt.sourceId,
        sourceType: excerpt.sourceType,
        sourceHash: excerpt.sourceHash,
        excerpt: excerpt.excerpt,
        excerptHash: excerpt.excerptHash
      },
      source
    );

    if (!validation.accepted) {
      rejectedProofs.push({
        proofId: excerpt.proofId,
        sourceId: excerpt.sourceId,
        reason: validation.rejectionReason ?? "unknown_rejection"
      });
      continue;
    }

    const proof = toProofRecord(excerpt, input.now);
    if (input.repositories.proofs.insertOrIgnore(proof)) {
      proofsInserted += 1;
    } else {
      assertMatchingProof(input.repositories.proofs.get(proof.proofId), proof);
    }
    acceptedSourceExcerpts.push(excerpt);
  }

  return {
    proofsInserted,
    proofsSeen: input.sourceExcerpts.length,
    rejectedProofs,
    acceptedSourceExcerpts
  };
}

function toProofRecord(excerpt: RepositoryArtifactSourceExcerptInput, now: string): ProofRecord {
  return {
    proofId: excerpt.proofId,
    sourceId: excerpt.sourceId,
    proofType: "exact_source_excerpt",
    sourceHash: excerpt.sourceHash,
    excerptHash: excerpt.excerptHash,
    supportStatus: "direct",
    createdAt: now
  };
}

function assertMatchingProof(existing: ProofRecord | undefined, next: ProofRecord): void {
  if (!existing) {
    throw new Error(`proof insert conflict without stored row: ${next.proofId}`);
  }

  assertField("proof source", existing.sourceId, next.sourceId);
  assertField("proof type", existing.proofType, next.proofType);
  assertField("proof source hash", existing.sourceHash, next.sourceHash);
  assertField("proof excerpt hash", existing.excerptHash, next.excerptHash);
  assertField("proof support status", existing.supportStatus, next.supportStatus);
}

function assertField(label: string, existing: string | undefined, next: string | undefined): void {
  if (existing !== next) {
    throw new Error(`${label} mismatch while persisting source proof`);
  }
}
