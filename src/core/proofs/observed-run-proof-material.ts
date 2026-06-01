import { hashStableJson, hashStableParts } from "../evidence/evidence-hash.js";
import type {
  ObservedRunProofCandidate,
  ObservedRunProofMaterial,
  ObservedRunProofMaterialResult,
  ObservedRunProofMetadata,
  ObservedRunProofRejectionReason,
  ObservedRunProofSource,
  ObservedRunSourceType
} from "./observed-run-proof-types.js";
import { observedRunResultProofType } from "./observed-run-proof-types.js";

export function extractObservedRunProofMaterial(
  source: ObservedRunProofSource | undefined
): ObservedRunProofMaterialResult {
  if (!source) return reject("source_missing");
  if (source.trustClass !== "trusted") return reject("source_not_trusted");
  if (source.privacyStatus !== "allowed") return reject("source_not_allowed");
  if (source.redactionStatus !== "redacted") return reject("source_redaction_not_redacted");
  if (source.sourceType !== "command_run" && source.sourceType !== "test_run") {
    return reject("unsupported_source_type");
  }

  const metadata = parseMetadata(source.metadataJson);
  if (!metadata) return reject("metadata_not_object");
  for (const rawField of ["command", "stdout", "stderr"]) {
    if (Object.prototype.hasOwnProperty.call(metadata, rawField)) return reject("raw_field_present");
  }

  const observedSource = source as ObservedRunProofSource & { readonly sourceType: ObservedRunSourceType };
  const typedMetadata = toObservedRunProofMetadata(observedSource, metadata);
  if (!typedMetadata.accepted) return typedMetadata;
  const materialWithoutHash = {
    sourceId: source.sourceId,
    sourceType: source.sourceType,
    sourceRef: source.sourceRef,
    sourceHash: source.sourceHash,
    sourceScope: source.sourceScope,
    metadata: typedMetadata.metadata
  };

  return {
    accepted: true,
    material: {
      ...materialWithoutHash,
      resultHash: observedRunResultHash(materialWithoutHash)
    }
  };
}

export function createObservedRunProofCandidate(material: ObservedRunProofMaterial): ObservedRunProofCandidate {
  return {
    proofId: observedRunProofId(material),
    sourceId: material.sourceId,
    sourceType: material.sourceType,
    sourceHash: material.sourceHash,
    resultHash: material.resultHash
  };
}

export function observedRunProofId(material: ObservedRunProofMaterial): string {
  return `proof:${hashStableParts([
    observedRunResultProofType,
    material.sourceId,
    material.resultHash
  ]).slice(0, 24)}`;
}

function toObservedRunProofMetadata(
  source: ObservedRunProofSource & { readonly sourceType: ObservedRunSourceType },
  metadata: Record<string, unknown>
):
  | { readonly accepted: true; readonly metadata: ObservedRunProofMetadata }
  | { readonly accepted: false; readonly rejectionReason: ObservedRunProofRejectionReason } {
  const requiredStrings = [
    "branch",
    "commit",
    "projectId",
    "repoId",
    "snapshotId",
    "sessionId",
    "worktreeHash",
    "observedRunId",
    "commandHash",
    "cwd",
    "stdoutHash",
    "stderrHash",
    "startedAt",
    "endedAt",
    "evidenceHash"
  ] as const;
  if (requiredStrings.some((field) => stringField(metadata, field).length === 0)) {
    return rejectMetadata("metadata_missing_required_field");
  }
  if (metadata.observedBy !== "grape" || metadata.observedByGrape !== true) {
    return rejectMetadata("observed_authority_invalid");
  }
  if (!/^run:[a-f0-9]{24}$/.test(stringField(metadata, "observedRunId"))) {
    return rejectMetadata("observed_run_id_invalid");
  }
  if (source.sourceRef !== `${source.sourceType}:${stringField(metadata, "observedRunId")}`) {
    return rejectMetadata("source_ref_mismatch");
  }
  if (source.sourceHash !== stringField(metadata, "evidenceHash")) {
    return rejectMetadata("metadata_hash_mismatch");
  }
  if (source.snapshotId && source.snapshotId !== stringField(metadata, "snapshotId")) {
    return rejectMetadata("metadata_hash_mismatch");
  }
  if (
    !isSha256(stringField(metadata, "commandHash")) ||
    !isSha256(stringField(metadata, "stdoutHash")) ||
    !isSha256(stringField(metadata, "stderrHash")) ||
    !isSha256(stringField(metadata, "evidenceHash"))
  ) {
    return rejectMetadata("hash_field_invalid");
  }

  const exitCode = metadata.exitCode;
  if (typeof exitCode !== "number" || !Number.isInteger(exitCode)) {
    return rejectMetadata("exit_code_invalid");
  }
  const redactedFields = metadata.redactedFields;
  if (!redactedFieldsAreComplete(redactedFields)) return rejectMetadata("metadata_missing_required_field");

  const passed = optionalBoolean(metadata, "passed");
  if (source.sourceType === "test_run") {
    if (passed === undefined) return rejectMetadata("test_passed_invalid");
    if (passed !== (exitCode === 0)) return rejectMetadata("test_passed_mismatch");
  }

  return {
    accepted: true,
    metadata: {
      branch: stringField(metadata, "branch"),
      commit: stringField(metadata, "commit"),
      projectId: stringField(metadata, "projectId"),
      repoId: stringField(metadata, "repoId"),
      snapshotId: stringField(metadata, "snapshotId"),
      sessionId: stringField(metadata, "sessionId"),
      worktreeHash: stringField(metadata, "worktreeHash"),
      observedRunId: stringField(metadata, "observedRunId"),
      observedBy: "grape",
      observedByGrape: true,
      commandHash: stringField(metadata, "commandHash"),
      cwd: stringField(metadata, "cwd"),
      exitCode,
      stdoutHash: stringField(metadata, "stdoutHash"),
      stderrHash: stringField(metadata, "stderrHash"),
      startedAt: stringField(metadata, "startedAt"),
      endedAt: stringField(metadata, "endedAt"),
      evidenceHash: stringField(metadata, "evidenceHash"),
      redactedFields,
      passed,
      testFramework: optionalString(metadata, "testFramework"),
      testFiles: optionalStringArray(metadata, "testFiles")
    }
  };
}

function observedRunResultHash(input: Omit<ObservedRunProofMaterial, "resultHash">): string {
  return hashStableJson({
    proofType: observedRunResultProofType,
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    sourceRef: input.sourceRef,
    sourceHash: input.sourceHash,
    sourceScope: input.sourceScope,
    branch: input.metadata.branch,
    commit: input.metadata.commit,
    projectId: input.metadata.projectId,
    repoId: input.metadata.repoId,
    snapshotId: input.metadata.snapshotId,
    sessionId: input.metadata.sessionId,
    worktreeHash: input.metadata.worktreeHash,
    observedRunId: input.metadata.observedRunId,
    commandHash: input.metadata.commandHash,
    cwd: input.metadata.cwd,
    exitCode: input.metadata.exitCode,
    stdoutHash: input.metadata.stdoutHash,
    stderrHash: input.metadata.stderrHash,
    startedAt: input.metadata.startedAt,
    endedAt: input.metadata.endedAt,
    passed: input.metadata.passed,
    testFramework: input.metadata.testFramework,
    testFiles: input.metadata.testFiles ?? []
  });
}

function parseMetadata(metadataJson: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function redactedFieldsAreComplete(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) return false;
  return ["command", "stdout", "stderr"].every((field) => value.includes(field));
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function stringField(metadata: Record<string, unknown>, field: string): string {
  const value = metadata[field];
  return typeof value === "string" ? value : "";
}

function optionalString(metadata: Record<string, unknown>, field: string): string | undefined {
  const value = metadata[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalStringArray(metadata: Record<string, unknown>, field: string): readonly string[] | undefined {
  const value = metadata[field];
  if (value === undefined) return undefined;
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

function optionalBoolean(metadata: Record<string, unknown>, field: string): boolean | undefined {
  const value = metadata[field];
  return typeof value === "boolean" ? value : undefined;
}

function reject(rejectionReason: ObservedRunProofRejectionReason): ObservedRunProofMaterialResult {
  return { accepted: false, rejectionReason };
}

function rejectMetadata(
  rejectionReason: ObservedRunProofRejectionReason
): { readonly accepted: false; readonly rejectionReason: ObservedRunProofRejectionReason } {
  return { accepted: false, rejectionReason };
}
