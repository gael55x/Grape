import type { SourceType } from "../../shared/index.js";

export interface EvidenceRecord {
  evidenceId: string;
  sourceId: string;
  sourceType: SourceType;
  sourcePath: string;
  sourceHash: string;
  repoId: string;
  snapshotId: string;
  observedAt: string;
  privacyStatus: "allowed" | "ignored" | "private" | "blocked_secret";
}
