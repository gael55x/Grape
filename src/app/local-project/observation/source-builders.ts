import {
  buildAgentCommandObservationSource,
  buildAgentTestObservationSource,
  buildGrapeCommandObservationSource,
  buildGrapeTestObservationSource
} from "../../../core/evidence/index.js";
import type {
  ObservationAuthority,
  ObservationContext,
  RecordLocalCommandResultInput,
  RecordLocalGrapeObservedCommandResultInput,
  RecordLocalGrapeObservedTestResultInput,
  RecordLocalTestResultInput
} from "./types.js";
import {
  assertExitCode,
  assertObservedRunId,
  normalizeSha256,
  normalizeTimestamp,
  normalizedOptionalString
} from "./validation.js";

export function buildCommandObservation(
  input: RecordLocalCommandResultInput,
  context: ObservationContext,
  cwd: string,
  now: string,
  authority: ObservationAuthority
) {
  const base = baseObservationInput(input, context, cwd, now);
  if (authority === "grape") {
    return buildGrapeCommandObservationSource({
      ...base,
      observedRunId: assertObservedRunId((input as RecordLocalGrapeObservedCommandResultInput).observedRunId)
    });
  }
  return buildAgentCommandObservationSource(base);
}

export function buildTestObservation(
  input: RecordLocalTestResultInput,
  context: ObservationContext,
  cwd: string,
  testFiles: readonly string[],
  now: string,
  authority: ObservationAuthority
) {
  const base = {
    ...baseObservationInput(input, context, cwd, now),
    passed: input.passed,
    testFramework: normalizedOptionalString(input.testFramework),
    testFiles
  };
  if (authority === "grape") {
    return buildGrapeTestObservationSource({
      ...base,
      observedRunId: assertObservedRunId((input as RecordLocalGrapeObservedTestResultInput).observedRunId)
    });
  }
  return buildAgentTestObservationSource(base);
}

function baseObservationInput(
  input: RecordLocalCommandResultInput,
  context: ObservationContext,
  cwd: string,
  now: string
) {
  return {
    projectId: context.projectId,
    repoId: context.repoId,
    snapshotId: context.snapshotId,
    sessionId: input.sessionId,
    branch: context.branch,
    commit: context.commit,
    worktreeHash: context.worktreeHash,
    commandHash: normalizeSha256("commandHash", input.commandHash),
    cwd,
    exitCode: assertExitCode(input.exitCode),
    stdoutHash: normalizeSha256("stdoutHash", input.stdoutHash),
    stderrHash: normalizeSha256("stderrHash", input.stderrHash),
    startedAt: normalizeTimestamp("startedAt", input.startedAt),
    endedAt: normalizeTimestamp("endedAt", input.endedAt),
    recordedAt: now
  };
}
