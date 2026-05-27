import { createHash } from "node:crypto";
import path from "node:path";

import type { SourceRecord, SourceRejectionRecord } from "../storage/index.js";
import type {
  PrivacyStatus,
  SourceRedactionStatus,
  SourceScope,
  SourceTrustClass,
  SourceType
} from "../../shared/index.js";

type SnapshotSourceKind = "source" | "test" | "rule" | "config" | "package" | "doc";

export interface RepoSnapshotEvidenceFile {
  readonly path: string;
  readonly sha256: string;
  readonly sourceKind: SnapshotSourceKind;
}

export interface RepoSnapshotEvidenceRejection {
  readonly path: string;
  readonly reason: "git_ignored" | "privacy_ignored" | "unreadable" | "too_large" | "binary";
  readonly privacyStatus: Extract<PrivacyStatus, "allowed" | "ignored" | "private">;
  readonly metadata?: {
    readonly sha256?: string;
    readonly sizeBytes?: number;
    readonly sourceKind?: SnapshotSourceKind;
  };
}

export interface CollectRepoSnapshotEvidenceInput {
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly worktreeStateId?: string;
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
  readonly dirtyPaths: readonly string[];
  readonly files: readonly RepoSnapshotEvidenceFile[];
  readonly rejectedFiles: readonly RepoSnapshotEvidenceRejection[];
  readonly capturedAt: string;
}

export interface CollectedRepoSnapshotEvidence {
  readonly sources: readonly SourceRecord[];
  readonly sourceRejections: readonly SourceRejectionRecord[];
}

export function collectRepoSnapshotEvidence(
  input: CollectRepoSnapshotEvidenceInput
): CollectedRepoSnapshotEvidence {
  const dirtyPaths = new Set(input.dirtyPaths);

  return {
    sources: input.files.map((file) => sourceRecord(input, file, sourceScopeForPath(file.path, dirtyPaths))),
    sourceRejections: input.rejectedFiles.map((file) => sourceRejectionRecord(input, file))
  };
}

export function classifySourceTrust(
  sourceType: SourceType,
  privacyStatus: PrivacyStatus,
  redactionStatus: SourceRedactionStatus
): SourceTrustClass {
  if (privacyStatus !== "allowed") return "untrusted";
  if (redactionStatus === "blocked") return "untrusted";

  switch (sourceType) {
    case "repository_file":
    case "git_diff":
    case "rule_file":
    case "config_file":
    case "lockfile":
    case "migration_file":
      return "trusted";
    default:
      return "temporary";
  }
}

function sourceRecord(
  input: CollectRepoSnapshotEvidenceInput,
  file: RepoSnapshotEvidenceFile,
  sourceScope: SourceScope
): SourceRecord {
  const sourceType = sourceTypeForFile(file);
  const redactionStatus: SourceRedactionStatus = "not_needed";
  const privacyStatus: PrivacyStatus = "allowed";

  return {
    sourceId: `source:${hashStableParts([input.repoId, input.snapshotId, file.path, file.sha256]).slice(0, 24)}`,
    snapshotId: input.snapshotId,
    sourceType,
    sourceRef: file.path,
    sourceHash: file.sha256,
    sourceScope,
    trustClass: classifySourceTrust(sourceType, privacyStatus, redactionStatus),
    privacyStatus,
    redactionStatus,
    metadataJson: JSON.stringify({
      branch: input.branch,
      commit: input.commit,
      projectId: input.projectId,
      repoId: input.repoId,
      snapshotId: input.snapshotId,
      sourceKind: file.sourceKind,
      sourceScopeBasis: sourceScope === "committed" ? "not_in_dirty_paths" : "dirty_paths_without_stage_split",
      worktreeHash: input.worktreeHash,
      worktreeStateId: input.worktreeStateId
    }),
    createdAt: input.capturedAt
  };
}

function sourceRejectionRecord(
  input: CollectRepoSnapshotEvidenceInput,
  file: RepoSnapshotEvidenceRejection
): SourceRejectionRecord {
  return {
    rejectionId: `source_rejection:${hashStableParts([
      input.repoId,
      input.snapshotId,
      file.path,
      file.reason,
      file.privacyStatus
    ]).slice(0, 24)}`,
    sourceRef: file.path,
    rejectionReason: file.reason,
    privacyStatus: file.privacyStatus,
    metadataJson: JSON.stringify({
      branch: input.branch,
      commit: input.commit,
      projectId: input.projectId,
      repoId: input.repoId,
      rejectionMetadata: file.metadata ?? {},
      snapshotId: input.snapshotId,
      worktreeHash: input.worktreeHash,
      worktreeStateId: input.worktreeStateId
    }),
    createdAt: input.capturedAt
  };
}

function sourceTypeForFile(file: RepoSnapshotEvidenceFile): SourceType {
  if (isLockfile(file.path)) return "lockfile";
  if (isMigrationPath(file.path)) return "migration_file";
  if (file.sourceKind === "rule") return "rule_file";
  if (file.sourceKind === "config") return "config_file";
  if (file.sourceKind === "package") return "config_file";
  return "repository_file";
}

function sourceScopeForPath(repoPath: string, dirtyPaths: ReadonlySet<string>): SourceScope {
  return dirtyPaths.has(repoPath) ? "unstaged" : "committed";
}

function isMigrationPath(repoPath: string): boolean {
  return repoPath.toLowerCase().includes("/migrations/") && repoPath.toLowerCase().endsWith(".sql");
}

function isLockfile(repoPath: string): boolean {
  const basename = path.posix.basename(repoPath.toLowerCase());
  return (
    basename === "package-lock.json" ||
    basename === "npm-shrinkwrap.json" ||
    basename === "yarn.lock" ||
    basename === "pnpm-lock.yaml" ||
    basename === "bun.lockb" ||
    basename.endsWith("-lock.json") ||
    basename.endsWith(".lock")
  );
}

function hashStableParts(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(String(part.length));
    hash.update(":");
    hash.update(part);
    hash.update("\n");
  }
  return hash.digest("hex");
}
