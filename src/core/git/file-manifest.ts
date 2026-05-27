import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";

import { isIgnoredByPrivacyPolicy, type PrivacyIgnorePolicy } from "../security/index.js";
import { classifySourceKind, type SourceKind } from "./source-kind.js";

export interface SnapshotFileHash {
  path: string;
  sha256: string;
  sourceKind: SourceKind;
}

export type SnapshotFileRejectionReason =
  | "git_ignored"
  | "privacy_ignored"
  | "unreadable"
  | "too_large"
  | "binary";

export interface SnapshotFileRejection {
  path: string;
  reason: SnapshotFileRejectionReason;
  privacyStatus: "allowed" | "ignored" | "private";
  metadata?: {
    readonly sha256?: string;
    readonly sizeBytes?: number;
    readonly sourceKind?: SourceKind;
  };
}

export interface GitVisibleFileManifest {
  files: SnapshotFileHash[];
  rejectedFiles: SnapshotFileRejection[];
}

export interface GitVisibleFileManifestInput {
  rootPath: string;
  repoPaths: readonly string[];
  gitIgnored: ReadonlySet<string>;
  privacyPolicy: PrivacyIgnorePolicy;
}

export const maxSnapshotFileBytes = 5 * 1024 * 1024;

export function readGitVisibleFileManifest(input: GitVisibleFileManifestInput): GitVisibleFileManifest {
  const rejectedFiles: SnapshotFileRejection[] = [];
  const files = input.repoPaths.flatMap((repoPath): SnapshotFileHash[] => {
    if (input.gitIgnored.has(repoPath)) {
      rejectedFiles.push({ path: repoPath, reason: "git_ignored", privacyStatus: "ignored" });
      return [];
    }
    if (isIgnoredByPrivacyPolicy(repoPath, input.privacyPolicy)) {
      rejectedFiles.push({ path: repoPath, reason: "privacy_ignored", privacyStatus: "private" });
      return [];
    }

    const absolutePath = path.join(input.rootPath, repoPath);

    try {
      const stat = lstatSync(absolutePath);
      if (!stat.isFile() && !stat.isSymbolicLink()) return [];
      const sourceKind = classifySourceKind(repoPath);

      const bytes = stat.isSymbolicLink()
        ? Buffer.from(`symlink:${readlinkSync(absolutePath)}`)
        : readSnapshotFileBytes(absolutePath, stat.size, repoPath, sourceKind, rejectedFiles);
      if (!bytes) return [];

      const fileHash = sha256(bytes);
      if (!stat.isSymbolicLink() && bytes.includes(0)) {
        rejectedFiles.push({
          path: repoPath,
          reason: "binary",
          privacyStatus: "allowed",
          metadata: { sha256: fileHash, sizeBytes: stat.size, sourceKind }
        });
        return [];
      }

      return [
        {
          path: repoPath,
          sha256: fileHash,
          sourceKind
        }
      ];
    } catch {
      rejectedFiles.push({ path: repoPath, reason: "unreadable", privacyStatus: "private" });
      return [];
    }
  });

  return { files, rejectedFiles };
}

function readSnapshotFileBytes(
  absolutePath: string,
  sizeBytes: number,
  repoPath: string,
  sourceKind: SourceKind,
  rejectedFiles: SnapshotFileRejection[]
): Buffer | undefined {
  if (sizeBytes > maxSnapshotFileBytes) {
    rejectedFiles.push({
      path: repoPath,
      reason: "too_large",
      privacyStatus: "allowed",
      metadata: { sizeBytes, sourceKind }
    });
    return undefined;
  }

  return readFileSync(absolutePath);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
