import { createHash } from "node:crypto";

import type { SourceRecord } from "../storage/index.js";

type ObservationSourceType = "command_run" | "test_run";

export interface AgentCommandObservationInput {
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly sessionId: string;
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
  readonly commandHash: string;
  readonly cwd: string;
  readonly exitCode: number;
  readonly stdoutHash: string;
  readonly stderrHash: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly recordedAt: string;
}

export interface AgentTestObservationInput extends AgentCommandObservationInput {
  readonly passed: boolean;
  readonly testFramework?: string;
  readonly testFiles: readonly string[];
}

export interface ReportedObservationEvidence {
  readonly source: SourceRecord;
  readonly evidenceHash: string;
  readonly redactedFields: readonly string[];
}

export function buildAgentCommandObservationSource(
  input: AgentCommandObservationInput
): ReportedObservationEvidence {
  return buildObservationSource("command_run", input, {});
}

export function buildAgentTestObservationSource(input: AgentTestObservationInput): ReportedObservationEvidence {
  return buildObservationSource("test_run", input, {
    passed: input.passed,
    testFramework: input.testFramework,
    testFiles: input.testFiles
  });
}

function buildObservationSource(
  sourceType: ObservationSourceType,
  input: AgentCommandObservationInput,
  extraMetadata: Record<string, unknown>
): ReportedObservationEvidence {
  const redactedFields = ["command", "stdout", "stderr"] as const;
  const evidenceHash = hashStableJson({
    sourceType,
    sessionId: input.sessionId,
    commandHash: input.commandHash,
    cwd: input.cwd,
    exitCode: input.exitCode,
    stdoutHash: input.stdoutHash,
    stderrHash: input.stderrHash,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    ...extraMetadata
  });
  const shortHash = evidenceHash.slice(0, 16);

  return {
    evidenceHash,
    redactedFields,
    source: {
      sourceId: `source:${hashStableParts([input.repoId, input.snapshotId, input.sessionId, sourceType, evidenceHash]).slice(0, 24)}`,
      snapshotId: input.snapshotId,
      sourceType,
      sourceRef: `${sourceType}:${shortHash}`,
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
        observedBy: "agent_reported",
        observedByGrape: false,
        commandHash: input.commandHash,
        cwd: input.cwd,
        exitCode: input.exitCode,
        stdoutHash: input.stdoutHash,
        stderrHash: input.stderrHash,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        evidenceHash,
        redactedFields,
        ...extraMetadata
      }),
      createdAt: input.recordedAt
    }
  };
}

function hashStableJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
