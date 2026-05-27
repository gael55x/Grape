import type { RepoSnapshot, SnapshotFileRejectionReason } from "../../core/git/index.js";

export interface LocalScanDiagnostics {
  readonly visibleFileCount: number;
  readonly rejectedFileCount: number;
  readonly rejectionReasonCounts: Readonly<Record<SnapshotFileRejectionReason, number>>;
}

export function scanDiagnosticsForSnapshot(snapshot: RepoSnapshot | undefined): LocalScanDiagnostics {
  const counts: Record<SnapshotFileRejectionReason, number> = {
    git_ignored: 0,
    privacy_ignored: 0,
    unreadable: 0,
    too_large: 0,
    binary: 0
  };

  for (const rejection of snapshot?.rejectedFiles ?? []) {
    counts[rejection.reason] += 1;
  }

  return {
    visibleFileCount: snapshot?.files.length ?? 0,
    rejectedFileCount: snapshot?.rejectedFiles.length ?? 0,
    rejectionReasonCounts: counts
  };
}
