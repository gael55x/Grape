import type { RepoSnapshot } from "../core/git/index.js";
import { collectRepoSnapshotEvidence } from "../core/evidence/index.js";
import type {
  EvidenceStorageRepositories,
  SourceRecord,
  SourceRejectionRecord
} from "../core/storage/index.js";

export interface PersistSnapshotEvidenceInput {
  readonly repositories: EvidenceStorageRepositories;
  readonly projectId: string;
  readonly worktreeStateId: string;
  readonly snapshot: RepoSnapshot;
  readonly now: string;
}

export interface PersistSnapshotEvidenceResult {
  readonly sourcesInserted: number;
  readonly sourceRejectionsInserted: number;
  readonly sourcesSeen: number;
  readonly sourceRejectionsSeen: number;
}

export function persistSnapshotEvidence(input: PersistSnapshotEvidenceInput): PersistSnapshotEvidenceResult {
  const evidence = collectRepoSnapshotEvidence({
    projectId: input.projectId,
    repoId: input.snapshot.repoId,
    snapshotId: input.snapshot.snapshotId,
    worktreeStateId: input.worktreeStateId,
    branch: input.snapshot.branch,
    commit: input.snapshot.commit,
    worktreeHash: input.snapshot.worktreeHash,
    dirtyPaths: input.snapshot.dirtyPaths,
    files: input.snapshot.files,
    rejectedFiles: input.snapshot.rejectedFiles,
    capturedAt: input.now
  });

  let sourcesInserted = 0;
  let sourceRejectionsInserted = 0;

  for (const source of evidence.sources) {
    if (input.repositories.sources.insertOrIgnore(source)) {
      sourcesInserted += 1;
    } else {
      assertMatchingSource(input.repositories.sources.get(source.sourceId), source);
    }
  }

  for (const rejection of evidence.sourceRejections) {
    if (input.repositories.sourceRejections.insertOrIgnore(rejection)) {
      sourceRejectionsInserted += 1;
    } else {
      assertMatchingSourceRejection(input.repositories.sourceRejections.get(rejection.rejectionId), rejection);
    }
  }

  return {
    sourcesInserted,
    sourceRejectionsInserted,
    sourcesSeen: evidence.sources.length,
    sourceRejectionsSeen: evidence.sourceRejections.length
  };
}

function assertMatchingSource(existing: SourceRecord | undefined, next: SourceRecord): void {
  if (!existing) {
    throw new Error(`source insert conflict without stored row: ${next.sourceId}`);
  }

  assertField("source snapshot", existing.snapshotId, next.snapshotId);
  assertField("source type", existing.sourceType, next.sourceType);
  assertField("source ref", existing.sourceRef, next.sourceRef);
  assertField("source hash", existing.sourceHash, next.sourceHash);
  assertField("source scope", existing.sourceScope, next.sourceScope);
  assertField("source trust class", existing.trustClass, next.trustClass);
  assertField("source privacy status", existing.privacyStatus, next.privacyStatus);
  assertField("source redaction status", existing.redactionStatus, next.redactionStatus);
  assertField("source metadata", existing.metadataJson, next.metadataJson);
}

function assertMatchingSourceRejection(
  existing: SourceRejectionRecord | undefined,
  next: SourceRejectionRecord
): void {
  if (!existing) {
    throw new Error(`source rejection insert conflict without stored row: ${next.rejectionId}`);
  }

  assertField("source rejection ref", existing.sourceRef, next.sourceRef);
  assertField("source rejection reason", existing.rejectionReason, next.rejectionReason);
  assertField("source rejection privacy status", existing.privacyStatus, next.privacyStatus);
  assertField("source rejection metadata", existing.metadataJson, next.metadataJson);
}

function assertField(label: string, existing: string | undefined, next: string | undefined): void {
  if (existing !== next) {
    throw new Error(`${label} mismatch while persisting snapshot evidence`);
  }
}
