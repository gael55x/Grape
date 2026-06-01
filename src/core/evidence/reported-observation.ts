import type { SourceRecord } from "../storage/index.js";
import { hashStableJson, hashStableParts } from "./evidence-hash.js";

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
  readonly observedRunId?: string;
  readonly observedBy?: "agent_reported" | "grape";
  readonly observedByGrape?: boolean;
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
  return buildObservationSource("command_run", input, {}, "temporary");
}

export function buildAgentTestObservationSource(input: AgentTestObservationInput): ReportedObservationEvidence {
  return buildObservationSource("test_run", input, {
    passed: input.passed,
    testFramework: input.testFramework,
    testFiles: input.testFiles
  }, "temporary");
}

export function buildGrapeCommandObservationSource(
  input: AgentCommandObservationInput & { readonly observedRunId: string }
): ReportedObservationEvidence {
  return buildObservationSource("command_run", {
    ...input,
    observedBy: "grape",
    observedByGrape: true
  }, {}, "trusted");
}

export function buildGrapeTestObservationSource(
  input: AgentTestObservationInput & { readonly observedRunId: string }
): ReportedObservationEvidence {
  return buildObservationSource("test_run", {
    ...input,
    observedBy: "grape",
    observedByGrape: true
  }, {
    passed: input.passed,
    testFramework: input.testFramework,
    testFiles: input.testFiles
  }, "trusted");
}

function buildObservationSource(
  sourceType: ObservationSourceType,
  input: AgentCommandObservationInput,
  extraMetadata: Record<string, unknown>,
  trustClass: "temporary" | "trusted"
): ReportedObservationEvidence {
  const redactedFields = ["command", "stdout", "stderr"] as const;
  const observedBy = input.observedBy ?? "agent_reported";
  const observedByGrape = input.observedByGrape ?? false;
  const evidenceHash = hashStableJson({
    sourceType,
    sessionId: input.sessionId,
    observedRunId: input.observedRunId,
    observedBy,
    observedByGrape,
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
      sourceRef: input.observedRunId ? `${sourceType}:${input.observedRunId}` : `${sourceType}:${shortHash}`,
      sourceHash: evidenceHash,
      sourceScope: "external",
      trustClass,
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
        observedRunId: input.observedRunId,
        observedBy,
        observedByGrape,
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
