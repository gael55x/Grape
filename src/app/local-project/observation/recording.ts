import { persistObservedRunResultClaim } from "../../persist-observed-run-claims.js";
import {
  createClaimStorageRepositories,
  createEvidenceStorageRepositories,
  createProofStorageRepositories,
  runStorageTransaction
} from "../../../core/storage/index.js";
import { withCurrentLocalContextSession } from "../writes/write-session-context.js";
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
      const claimRepositories = createClaimStorageRepositories(database);
      const proofRepositories = createProofStorageRepositories(database);
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
      return runStorageTransaction(database, () => {
        const inserted = evidenceRepositories.sources.insertOrIgnore(observation.source);
        const promotion = authority === "grape"
          ? persistObservedRunResultClaim({
              repositories: claimRepositories,
              proofRepositories,
              source: observation.source,
              now
            })
          : undefined;
        return { observation, inserted, promotion };
      });
    }
  );
  const promotion = databaseResult.value.promotion;
  const durableClaim = Boolean(promotion?.claimId && promotion.rejectedCandidates.length === 0);

  return {
    rootPath: databaseResult.context.rootPath,
    evidenceId: databaseResult.value.observation.source.sourceId,
    sourceId: databaseResult.value.observation.source.sourceId,
    sourceType,
    sourceRef: databaseResult.value.observation.source.sourceRef,
    sourceHash: databaseResult.value.observation.source.sourceHash,
    trustClass: authority === "grape" ? "trusted" : "temporary",
    durable: durableClaim,
    durableClaim,
    proofId: promotion?.proofId,
    claimId: durableClaim ? promotion?.claimId : undefined,
    claimType: durableClaim ? promotion?.claimType : undefined,
    observedBy: authority,
    observedRunId:
      authority === "grape" ? (input as RecordLocalGrapeObservedCommandResultInput).observedRunId : undefined,
    inserted: databaseResult.value.inserted,
    redactedFields: databaseResult.value.observation.redactedFields,
    warnings:
      authority === "grape"
        ? observedRunWarnings(promotion)
        : ["agent_reported_evidence_is_temporary", "raw_command_and_output_not_persisted"]
  };
}

function observedRunWarnings(
  promotion: ReturnType<typeof persistObservedRunResultClaim> | undefined
): readonly string[] {
  const warnings = ["raw_command_and_output_not_persisted", "observed_run_claim_proves_result_only"];
  if (!promotion) return warnings;
  if (promotion.rejectedProofs.length > 0 || promotion.rejectedCandidates.length > 0) {
    return [
      "grape_observed_run_result_promotion_rejected",
      ...warnings
    ];
  }
  return [
    "grape_observed_run_result_promoted_to_durable_claim",
    ...warnings
  ];
}
