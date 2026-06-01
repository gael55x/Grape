import { createEvidenceStorageRepositories } from "../../../core/storage/index.js";
import { withCurrentLocalContextSession } from "../write-session-context.js";
import { normalizeRepoRelativePath } from "./path.js";
import { buildCommandObservation, buildTestObservation } from "./source-builders.js";
import type {
  ObservationAuthority,
  ObservationSourceType,
  RecordLocalCommandResultInput,
  RecordLocalGrapeObservedCommandResultInput,
  RecordLocalGrapeObservedTestResultInput,
  RecordLocalObservationResult,
  RecordLocalTestResultInput
} from "./types.js";
import { assertCommandInput } from "./validation.js";

export function recordLocalCommandResult(input: RecordLocalCommandResultInput): RecordLocalObservationResult {
  return recordObservation(input, "command_run");
}

export function recordLocalTestResult(input: RecordLocalTestResultInput): RecordLocalObservationResult {
  return recordObservation(input, "test_run");
}

export function recordLocalGrapeObservedCommandResult(
  input: RecordLocalGrapeObservedCommandResultInput
): RecordLocalObservationResult {
  return recordObservation(input, "command_run", "grape");
}

export function recordLocalGrapeObservedTestResult(
  input: RecordLocalGrapeObservedTestResultInput
): RecordLocalObservationResult {
  return recordObservation(input, "test_run", "grape");
}

function recordObservation(
  input: RecordLocalCommandResultInput | RecordLocalTestResultInput,
  sourceType: ObservationSourceType,
  authority: ObservationAuthority = "agent_reported"
): RecordLocalObservationResult {
  const now = input.now ?? new Date().toISOString();
  assertCommandInput(input);

  const databaseResult = withCurrentLocalContextSession(
    {
      rootPath: input.rootPath,
      sessionId: input.sessionId,
      now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir,
      missingSessionMessage: "context session not found. Call grape_get_context before recording agent evidence.",
      staleSessionMessage: "context session is stale. Call grape_get_context before recording agent evidence."
    },
    ({ database, context }) => {
      const evidenceRepositories = createEvidenceStorageRepositories(database);
      const cwd = normalizeRepoRelativePath(context.rootPath, input.cwd, "cwd");
      const testFiles =
        sourceType === "test_run"
          ? ((input as RecordLocalTestResultInput).testFiles ?? []).map((file) =>
              normalizeRepoRelativePath(context.rootPath, file, "test file")
            )
          : [];

      const observation =
        sourceType === "command_run"
          ? buildCommandObservation(input, context, cwd, now, authority)
          : buildTestObservation(input as RecordLocalTestResultInput, context, cwd, testFiles, now, authority);
      const inserted = evidenceRepositories.sources.insertOrIgnore(observation.source);
      return { observation, inserted };
    }
  );

  return {
    rootPath: databaseResult.context.rootPath,
    evidenceId: databaseResult.value.observation.source.sourceId,
    sourceId: databaseResult.value.observation.source.sourceId,
    sourceType,
    sourceRef: databaseResult.value.observation.source.sourceRef,
    sourceHash: databaseResult.value.observation.source.sourceHash,
    trustClass: authority === "grape" ? "trusted" : "temporary",
    durable: false,
    observedBy: authority,
    observedRunId:
      authority === "grape" ? (input as RecordLocalGrapeObservedCommandResultInput).observedRunId : undefined,
    inserted: databaseResult.value.inserted,
    redactedFields: databaseResult.value.observation.redactedFields,
    warnings:
      authority === "grape"
        ? ["grape_observed_evidence_is_trusted_source_not_durable_claim", "raw_command_and_output_not_persisted"]
        : ["agent_reported_evidence_is_temporary", "raw_command_and_output_not_persisted"]
  };
}
