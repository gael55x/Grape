import type { SourceRecord } from "../storage/index.js";
import { hashStableJson, hashStableParts } from "./evidence-hash.js";

export interface AgentCandidateInput {
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly sessionId: string;
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
  readonly subject: string;
  readonly claimType: string;
  readonly claimTextHash: string;
  readonly scope: Record<string, unknown>;
  readonly recordedAt: string;
}

export interface ReportedCandidateEvidence {
  readonly source: SourceRecord;
  readonly evidenceHash: string;
  readonly redactedFields: readonly string[];
}

export function buildAgentCandidateSource(input: AgentCandidateInput): ReportedCandidateEvidence {
  const redactedFields = ["claimText"] as const;
  const evidenceHash = hashStableJson({
    sourceType: "assistant_response",
    sessionId: input.sessionId,
    subject: input.subject,
    claimType: input.claimType,
    claimTextHash: input.claimTextHash,
    scope: input.scope
  });
  const shortHash = evidenceHash.slice(0, 16);

  return {
    evidenceHash,
    redactedFields,
    source: {
      sourceId: `source:${hashStableParts([input.repoId, input.snapshotId, input.sessionId, "candidate", evidenceHash]).slice(0, 24)}`,
      snapshotId: input.snapshotId,
      sourceType: "assistant_response",
      sourceRef: `agent_candidate:${shortHash}`,
      sourceHash: evidenceHash,
      sourceScope: "external",
      trustClass: "temporary",
      privacyStatus: "allowed",
      redactionStatus: "redacted",
      metadataJson: JSON.stringify({
        branch: input.branch,
        commit: input.commit,
        projectId: input.projectId,
        repoId: input.repoId,
        snapshotId: input.snapshotId,
        sessionId: input.sessionId,
        worktreeHash: input.worktreeHash,
        observedBy: "agent_reported_candidate",
        subject: input.subject,
        claimType: input.claimType,
        claimTextHash: input.claimTextHash,
        scope: input.scope,
        evidenceHash,
        redactedFields
      }),
      createdAt: input.recordedAt
    }
  };
}
