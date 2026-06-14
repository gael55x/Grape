import { persistObservedRunResultClaim } from "../../persist-observed-run-claims.js";
import { persistObservedTestFailureRelations } from "../../persist-observed-test-failure-relations.js";
import { extractObservedRunProofMaterial } from "../../../core/proofs/index.js";
import {
  createClaimStorageRepositories,
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
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
import type {
  ClaimStorageRepositories,
  EvidenceStorageRepositories,
  IndexingStorageRepositories,
  ProofStorageRepositories,
  SourceRecord
} from "../../../core/storage/index.js";

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
      missingSessionMessage: `Context session ${input.sessionId} not found. Run grape compile --task "<task>" --session ${input.sessionId} first, or list sessions with grape sessions.`,
      staleSessionMessage: `Context session ${input.sessionId} is stale (branch or commit changed). Rerun grape compile --task "<task>" --session ${input.sessionId}, or start a new --session.`
    },
    ({ database, context }) => {
      const evidenceRepositories = createEvidenceStorageRepositories(database);
      const claimRepositories = createClaimStorageRepositories(database);
      const proofRepositories = createProofStorageRepositories(database);
      const indexingRepositories = createIndexingStorageRepositories(database);
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
        const failureRelation =
          authority === "grape" &&
          sourceType === "test_run" &&
          promotion?.claimId &&
          promotion.rejectedCandidates.length === 0 &&
          !(input as RecordLocalTestResultInput).passed
            ? persistFailureRelations({
                claimRepositories,
                proofRepositories,
                evidenceRepositories,
                indexingRepositories,
                rootPath: context.rootPath,
                source: observation.source,
                observedRunClaimId: promotion.claimId,
                observedRunProofId: promotion.proofId ?? "",
                failureOutputText: (input as RecordLocalGrapeObservedTestResultInput).failureOutputText ?? "",
                now
              })
            : undefined;
        return { observation, inserted, promotion, failureRelation };
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
        ? observedRunWarnings(promotion, databaseResult.value.failureRelation)
        : ["agent_reported_evidence_is_temporary", "raw_command_and_output_not_persisted"]
  };
}

function persistFailureRelations(input: {
  readonly claimRepositories: ClaimStorageRepositories;
  readonly proofRepositories: ProofStorageRepositories;
  readonly evidenceRepositories: EvidenceStorageRepositories;
  readonly indexingRepositories: IndexingStorageRepositories;
  readonly rootPath: string;
  readonly source: SourceRecord;
  readonly observedRunClaimId: string;
  readonly observedRunProofId: string;
  readonly failureOutputText: string;
  readonly now: string;
}) {
  const material = extractObservedRunProofMaterial(input.source);
  if (!material.accepted) return undefined;
  return persistObservedTestFailureRelations({
    repositories: input.claimRepositories,
    proofRepositories: input.proofRepositories,
    evidenceRepositories: input.evidenceRepositories,
    indexingRepositories: input.indexingRepositories,
    rootPath: input.rootPath,
    source: input.source,
    material: material.material,
    observedRunClaimId: input.observedRunClaimId,
    observedRunProofId: input.observedRunProofId,
    failureOutputText: input.failureOutputText,
    now: input.now
  });
}

function observedRunWarnings(
  promotion: ReturnType<typeof persistObservedRunResultClaim> | undefined,
  failureRelation: ReturnType<typeof persistObservedTestFailureRelations> | undefined
): readonly string[] {
  const warnings = ["raw_command_and_output_not_persisted", "observed_run_claim_proves_result_only"];
  if (!promotion) return warnings;
  if (promotion.rejectedProofs.length > 0 || promotion.rejectedCandidates.length > 0) {
    return ["grape_observed_run_result_promotion_rejected", ...warnings];
  }
  const result = ["grape_observed_run_result_promoted_to_durable_claim", ...warnings];
  if (!failureRelation) return result;
  if (failureRelation.claimId && failureRelation.rejectedCandidates.length === 0) {
    return [
      ...result,
      "observed_test_failure_span_link_promoted",
      "observed_failure_span_link_is_candidate_only"
    ];
  }
  if (failureRelation.rejectedProofs.length > 0 || failureRelation.rejectedCandidates.length > 0) {
    return [...result, "observed_test_failure_span_link_promotion_rejected"];
  }
  return result;
}
