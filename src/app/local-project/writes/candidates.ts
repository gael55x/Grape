import type { DatabaseSync } from "node:sqlite";

import {
  buildAgentCandidateSource,
  buildAgentUserDecisionSource,
  type UserDecisionConfirmationChannel
} from "../../../core/evidence/index.js";
import { assertArtifactTextHasNoSecrets } from "../../../core/security/index.js";
import { assertConservativeTrustWording } from "../../../shared/trust-wording.js";
import {
  createClaimStorageRepositories,
  createEvidenceStorageRepositories
} from "../../../core/storage/index.js";
import { sha256 } from "../context/compile-ids.js";
import {
  assertHashMatches,
  boundedString,
  normalizeConfirmationChannel,
  normalizedScope,
  normalizeSha256,
  normalizeTimestamp,
  requiredBoolean,
  safeToken
} from "./restricted-write-validation.js";
import {
  withCurrentLocalContextSession,
  type CurrentLocalContextSession
} from "./write-session-context.js";

export interface RecordLocalCandidateInput {
  readonly rootPath: string;
  readonly sessionId: string;
  readonly subject: string;
  readonly claimType: string;
  readonly claimText: string;
  readonly scope: Record<string, unknown>;
  readonly sourceId?: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface RecordLocalCandidateResult {
  readonly rootPath: string;
  readonly candidateId: string;
  readonly sourceId: string;
  readonly sourceType: string;
  readonly durable: false;
  readonly promoted: false;
  readonly inserted: boolean;
  readonly evidenceInserted: boolean;
  readonly warnings: readonly string[];
}

export interface RecordLocalUserDecisionInput {
  readonly rootPath: string;
  readonly sessionId: string;
  readonly prompt: string;
  readonly promptHash: string;
  readonly response: string;
  readonly responseHash: string;
  readonly confirmationChannel: UserDecisionConfirmationChannel;
  readonly confirmedByUser: boolean;
  readonly confirmedAt: string;
  readonly scope: Record<string, unknown>;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface RecordLocalUserDecisionResult {
  readonly rootPath: string;
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly sourceType: "user_message";
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly durable: false;
  readonly observedBy: "agent_reported_user_decision";
  readonly inserted: boolean;
  readonly redactedFields: readonly string[];
  readonly warnings: readonly string[];
}

export interface RequestLocalUserConfirmationInput {
  readonly rootPath: string;
  readonly sessionId: string;
  readonly prompt: string;
  readonly promptHash: string;
  readonly scope: Record<string, unknown>;
  readonly reason?: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface RequestLocalUserConfirmationResult {
  readonly rootPath: string;
  readonly confirmationRequestId: string;
  readonly status: "requires_user_confirmation";
  readonly promptHash: string;
  readonly scope: Record<string, unknown>;
  readonly durable: false;
  readonly warnings: readonly string[];
  readonly recoveryGuidance: readonly string[];
}

export function recordLocalCandidate(input: RecordLocalCandidateInput): RecordLocalCandidateResult {
  const subject = boundedString(input.subject, "subject", 300);
  const claimType = safeToken(input.claimType, "claimType");
  const claimText = boundedString(input.claimText, "claimText", 2000);
  const scope = normalizedScope(input.scope);
  assertConservativeTrustWording(claimText, "claim candidate");
  assertArtifactTextHasNoSecrets(JSON.stringify({ subject, claimType, claimText, scope }), "claim candidate");

  const result = withWritableSession(input, ({ database, context }) => {
    const claimRepositories = createClaimStorageRepositories(database);
    const evidenceRepositories = createEvidenceStorageRepositories(database);
    const sourceId = input.sourceId ? safeToken(input.sourceId, "sourceId") : undefined;
    const linkedSource = sourceId ? evidenceRepositories.sources.get(sourceId) : undefined;
    if (sourceId && !linkedSource) throw new Error("candidate sourceId was not found");
    if (linkedSource && linkedSource.snapshotId !== context.snapshotId) {
      throw new Error("candidate sourceId must belong to the current repo snapshot");
    }
    const candidateEvidence = linkedSource
      ? undefined
      : buildAgentCandidateSource({
          projectId: context.projectId,
          repoId: context.repoId,
          snapshotId: context.snapshotId,
          sessionId: input.sessionId,
          branch: context.branch,
          commit: context.commit,
          worktreeHash: context.worktreeHash,
          subject,
          claimType,
          claimTextHash: sha256(claimText),
          scope,
          recordedAt: input.now ?? new Date().toISOString()
        });
    const candidateSource = linkedSource ?? candidateEvidence?.source;
    if (!candidateSource) throw new Error("candidate source could not be resolved");
    const evidenceInserted = candidateEvidence
      ? evidenceRepositories.sources.insertOrIgnore(candidateEvidence.source)
      : false;

    const candidateId = `candidate:${sha256(
      JSON.stringify({
        repoId: context.repoId,
        snapshotId: context.snapshotId,
        sessionId: input.sessionId,
        subject,
        claimType,
        claimText,
        scope
      })
    ).slice(0, 24)}`;
    const inserted = claimRepositories.claimCandidates.insertOrIgnore({
      candidateId,
      sourceId: candidateSource.sourceId,
      subject,
      claimType,
      claimText,
      scopeJson: JSON.stringify(scope),
      rejectionReason: "mcp_candidate_requires_proof",
      createdAt: input.now ?? new Date().toISOString()
    });
    return { candidateId, source: candidateSource, inserted, evidenceInserted };
  });

  return {
    rootPath: result.context.rootPath,
    candidateId: result.value.candidateId,
    sourceId: result.value.source.sourceId,
    sourceType: result.value.source.sourceType,
    durable: false,
    promoted: false,
    inserted: result.value.inserted,
    evidenceInserted: result.value.evidenceInserted,
    warnings: ["mcp_candidate_not_durable", "candidate_requires_trust_kernel_promotion"]
  };
}

export function recordLocalUserDecision(input: RecordLocalUserDecisionInput): RecordLocalUserDecisionResult {
  const prompt = boundedString(input.prompt, "prompt", 4000);
  const response = boundedString(input.response, "response", 4000);
  const confirmationChannel = normalizeConfirmationChannel(input.confirmationChannel);
  const confirmedByUser = requiredBoolean(input.confirmedByUser, "confirmedByUser");
  const scope = normalizedScope(input.scope);
  assertArtifactTextHasNoSecrets(JSON.stringify({ prompt, response, scope }), "user decision");
  assertHashMatches("promptHash", prompt, input.promptHash);
  assertHashMatches("responseHash", response, input.responseHash);

  const result = withWritableSession(input, ({ database, context }) => {
    const evidenceRepositories = createEvidenceStorageRepositories(database);
    const decision = buildAgentUserDecisionSource({
      projectId: context.projectId,
      repoId: context.repoId,
      snapshotId: context.snapshotId,
      sessionId: input.sessionId,
      branch: context.branch,
      commit: context.commit,
      worktreeHash: context.worktreeHash,
      promptHash: normalizeSha256("promptHash", input.promptHash),
      responseHash: normalizeSha256("responseHash", input.responseHash),
      confirmationChannel,
      confirmedByUser,
      confirmedAt: normalizeTimestamp("confirmedAt", input.confirmedAt),
      scope,
      recordedAt: input.now ?? new Date().toISOString()
    });
    const inserted = evidenceRepositories.sources.insertOrIgnore(decision.source);
    return { decision, inserted };
  });

  return {
    rootPath: result.context.rootPath,
    evidenceId: result.value.decision.source.sourceId,
    sourceId: result.value.decision.source.sourceId,
    sourceType: "user_message",
    sourceRef: result.value.decision.source.sourceRef,
    sourceHash: result.value.decision.source.sourceHash,
    durable: false,
    observedBy: "agent_reported_user_decision",
    inserted: result.value.inserted,
    redactedFields: result.value.decision.redactedFields,
    warnings: ["user_decision_evidence_is_temporary", "durable_decision_requires_trust_kernel_promotion"]
  };
}

export function requestLocalUserConfirmation(
  input: RequestLocalUserConfirmationInput
): RequestLocalUserConfirmationResult {
  const prompt = boundedString(input.prompt, "prompt", 4000);
  const reason = input.reason === undefined ? undefined : boundedString(input.reason, "reason", 1000);
  const scope = normalizedScope(input.scope);
  assertArtifactTextHasNoSecrets(JSON.stringify({ prompt, scope, reason }), "confirmation request");
  assertHashMatches("promptHash", prompt, input.promptHash);

  const result = withWritableSession(input, ({ context }) => ({
    confirmationRequestId: `confirmation:${sha256(
      JSON.stringify({
        repoId: context.repoId,
        snapshotId: context.snapshotId,
        sessionId: input.sessionId,
        promptHash: normalizeSha256("promptHash", input.promptHash),
        scope,
        reason: reason ?? ""
      })
    ).slice(0, 24)}`
  }));

  return {
    rootPath: result.context.rootPath,
    confirmationRequestId: result.value.confirmationRequestId,
    status: "requires_user_confirmation",
    promptHash: normalizeSha256("promptHash", input.promptHash),
    scope,
    durable: false,
    warnings: ["client_must_collect_direct_user_confirmation", "no_durable_truth_was_written"],
    recoveryGuidance: [
      "Show the original prompt to the user, then call grape_record_user_decision only after direct confirmation."
    ]
  };
}

function withWritableSession<T>(
  input: {
    readonly rootPath: string;
    readonly sessionId: string;
    readonly now?: string;
    readonly gitBinary?: string;
    readonly migrationsDir?: string;
  },
  operation: (input: { readonly database: DatabaseSync; readonly context: CurrentLocalContextSession }) => T
): { readonly context: CurrentLocalContextSession; readonly value: T } {
  return withCurrentLocalContextSession(
    {
      rootPath: input.rootPath,
      sessionId: input.sessionId,
      now: input.now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir,
      missingSessionMessage: "context session not found. Call grape_get_context before recording candidate evidence.",
      staleSessionMessage: "context session is stale. Call grape_get_context before recording candidate evidence."
    },
    operation
  );
}
