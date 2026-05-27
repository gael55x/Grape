import path from "node:path";

import {
  buildAgentCommandObservationSource,
  buildAgentTestObservationSource
} from "../../core/evidence/index.js";
import { assertArtifactTextHasNoSecrets } from "../../core/security/index.js";
import { createEvidenceStorageRepositories } from "../../core/storage/index.js";
import { sha256 } from "./compile-ids.js";
import { withCurrentLocalContextSession } from "./write-session-context.js";

export interface RecordLocalCommandResultInput {
  readonly rootPath: string;
  readonly sessionId: string;
  readonly command: string;
  readonly commandHash: string;
  readonly cwd: string;
  readonly exitCode: number;
  readonly stdoutHash: string;
  readonly stderrHash: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface RecordLocalTestResultInput extends RecordLocalCommandResultInput {
  readonly passed: boolean;
  readonly testFramework?: string;
  readonly testFiles?: readonly string[];
}

export interface RecordLocalObservationResult {
  readonly rootPath: string;
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly sourceType: "command_run" | "test_run";
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly trustClass: "temporary";
  readonly durable: false;
  readonly observedBy: "agent_reported";
  readonly inserted: boolean;
  readonly redactedFields: readonly string[];
  readonly warnings: readonly string[];
}

export function recordLocalCommandResult(input: RecordLocalCommandResultInput): RecordLocalObservationResult {
  return recordObservation(input, "command_run");
}

export function recordLocalTestResult(input: RecordLocalTestResultInput): RecordLocalObservationResult {
  return recordObservation(input, "test_run");
}

function recordObservation(
  input: RecordLocalCommandResultInput | RecordLocalTestResultInput,
  sourceType: "command_run" | "test_run"
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
          ? buildAgentCommandObservationSource({
              ...baseObservationInput(input, context, cwd, now)
            })
          : buildAgentTestObservationSource({
              ...baseObservationInput(input, context, cwd, now),
              passed: (input as RecordLocalTestResultInput).passed,
              testFramework: normalizedOptionalString((input as RecordLocalTestResultInput).testFramework),
              testFiles
            });
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
    trustClass: "temporary",
    durable: false,
    observedBy: "agent_reported",
    inserted: databaseResult.value.inserted,
    redactedFields: databaseResult.value.observation.redactedFields,
    warnings: ["agent_reported_evidence_is_temporary", "raw_command_and_output_not_persisted"]
  };
}

function baseObservationInput(
  input: RecordLocalCommandResultInput,
  context: {
    readonly projectId: string;
    readonly repoId: string;
    readonly snapshotId: string;
    readonly branch: string;
    readonly commit: string;
    readonly worktreeHash: string;
  },
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

function assertCommandInput(input: RecordLocalCommandResultInput | RecordLocalTestResultInput): void {
  if (typeof input.command !== "string" || input.command.trim() === "") {
    throw new Error("command must be a non-empty string");
  }
  const commandHash = normalizeSha256("commandHash", input.commandHash);
  if (sha256(input.command) !== commandHash) throw new Error("commandHash does not match command");
  assertArtifactTextHasNoSecrets(
    JSON.stringify({
      command: input.command,
      cwd: input.cwd,
      testFiles: "testFiles" in input ? input.testFiles ?? [] : []
    }),
    "agent observation"
  );
  normalizeSha256("stdoutHash", input.stdoutHash);
  normalizeSha256("stderrHash", input.stderrHash);
  assertExitCode(input.exitCode);
  const started = Date.parse(normalizeTimestamp("startedAt", input.startedAt));
  const ended = Date.parse(normalizeTimestamp("endedAt", input.endedAt));
  if (ended < started) throw new Error("endedAt must be greater than or equal to startedAt");
  if ("passed" in input && typeof input.passed !== "boolean") throw new Error("passed must be a boolean");
}

function normalizeSha256(label: string, value: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`${label} must be a SHA-256 hex digest`);
  }
  return value.toLowerCase();
}

function assertExitCode(value: number): number {
  if (!Number.isInteger(value)) throw new Error("exitCode must be an integer");
  return value;
}

function normalizeTimestamp(label: string, value: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be an ISO timestamp`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be an ISO timestamp`);
  return new Date(parsed).toISOString();
}

function normalizeRepoRelativePath(rootPath: string, inputPath: string, label: string): string {
  if (typeof inputPath !== "string" || inputPath.trim() === "") throw new Error(`${label} must be a non-empty path`);
  if (path.win32.isAbsolute(inputPath) && !path.isAbsolute(inputPath)) {
    throw new Error(`${label} must be inside the repository root`);
  }
  const portableInput = inputPath.replace(/\\/g, path.sep);
  const resolved = path.isAbsolute(portableInput)
    ? path.resolve(portableInput)
    : path.resolve(rootPath, portableInput);
  const relative = path.relative(rootPath, resolved);
  if (relative === "") return ".";
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must be inside the repository root`);
  }
  return relative.split(path.sep).join("/");
}

function normalizedOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
