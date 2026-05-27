import type { SourceRecord } from "../storage/index.js";
import { hashStableJson, hashStableParts } from "./evidence-hash.js";

export type UserDecisionConfirmationChannel = "cli_prompt" | "mcp_user_confirmation" | "config_file" | "rule_file";

export interface AgentUserDecisionInput {
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly sessionId: string;
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
  readonly promptHash: string;
  readonly responseHash: string;
  readonly confirmationChannel: UserDecisionConfirmationChannel;
  readonly confirmedByUser: boolean;
  readonly confirmedAt: string;
  readonly scope: Record<string, unknown>;
  readonly recordedAt: string;
}

export interface ReportedDecisionEvidence {
  readonly source: SourceRecord;
  readonly evidenceHash: string;
  readonly redactedFields: readonly string[];
}

export function buildAgentUserDecisionSource(input: AgentUserDecisionInput): ReportedDecisionEvidence {
  const redactedFields = ["prompt", "response"] as const;
  const evidenceHash = hashStableJson({
    sourceType: "user_message",
    sessionId: input.sessionId,
    promptHash: input.promptHash,
    responseHash: input.responseHash,
    confirmationChannel: input.confirmationChannel,
    confirmedByUser: input.confirmedByUser,
    confirmedAt: input.confirmedAt,
    scope: input.scope
  });
  const shortHash = evidenceHash.slice(0, 16);

  return {
    evidenceHash,
    redactedFields,
    source: {
      sourceId: `source:${hashStableParts([input.repoId, input.snapshotId, input.sessionId, "user_decision", evidenceHash]).slice(0, 24)}`,
      snapshotId: input.snapshotId,
      sourceType: "user_message",
      sourceRef: `user_decision:${shortHash}`,
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
        observedBy: "agent_reported_user_decision",
        promptHash: input.promptHash,
        responseHash: input.responseHash,
        confirmationChannel: input.confirmationChannel,
        confirmedByUser: input.confirmedByUser,
        confirmedAt: input.confirmedAt,
        scope: input.scope,
        evidenceHash,
        redactedFields
      }),
      createdAt: input.recordedAt
    }
  };
}
