export interface LocalSessionSummary {
  readonly sessionId: string;
  readonly status: string;
  readonly lockStatus: string;
  readonly taskId?: string;
  readonly taskType?: string;
  readonly branchName: string;
  readonly headCommitSha: string;
  readonly startedAt: string;
  readonly lastSeenAt: string;
  readonly updatedAt: string;
  readonly artifactCount: number;
  readonly sentItemCount: number;
  readonly omittedItemCount: number;
  readonly packItemCount: number;
  readonly eventCount: number;
  readonly lastEventReason?: string;
}

export interface ListLocalSessionsInput {
  readonly rootPath: string;
  readonly migrationsDir?: string;
}

export interface ListLocalSessionsResult {
  readonly rootPath: string;
  readonly sessions: readonly LocalSessionSummary[];
}

export interface LocalProofSummary {
  readonly proofId: string;
  readonly claimId?: string;
  readonly sourceId: string;
  readonly sourceType?: string;
  readonly sourceRef?: string;
  readonly sourceScope?: string;
  readonly proofType: string;
  readonly sourceHash: string;
  readonly excerptHash: string;
  readonly supportStatus: string;
  readonly privacyStatus?: string;
  readonly redactionStatus?: string;
  readonly createdAt: string;
}

export interface ListLocalProofsInput {
  readonly rootPath: string;
  readonly proofId?: string;
  readonly sourceId?: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface ListLocalProofsResult {
  readonly rootPath: string;
  readonly filter: {
    readonly proofId?: string;
    readonly sourceId?: string;
  };
  readonly proofs: readonly LocalProofSummary[];
}

export interface LocalClaimSummary {
  readonly claimId: string;
  readonly subject: string;
  readonly claimType: string;
  readonly claimText: string;
  readonly verificationStatus: string;
  readonly scope: Record<string, unknown>;
  readonly scopeHash: string;
  readonly proofRefs: readonly string[];
  readonly proofHashes: readonly string[];
  readonly sourceRefs: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListLocalClaimsInput {
  readonly rootPath: string;
  readonly activeOnly?: boolean;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface ListLocalClaimsResult {
  readonly rootPath: string;
  readonly activeOnly: boolean;
  readonly claims: readonly LocalClaimSummary[];
  readonly rejectedCount: number;
  readonly warnings: readonly string[];
}
