import path from "node:path";

import {
  buildAgentCommandObservationSource,
  buildAgentTestObservationSource
} from "../../core/evidence/index.js";
import { createGitRepoSnapshot } from "../../core/git/index.js";
import {
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createStorageRepositories
} from "../../core/storage/index.js";
import { persistGitRepoSnapshot } from "../persist-repo-snapshot.js";
import { ensureLocalProjectBootstrapped } from "./bootstrap.js";
import { ensureLocalProjectLayout, readLocalProjectConfig } from "./config.js";
import { assertSafeId, sha256 } from "./compile-ids.js";
import { withMigratedLocalDatabase } from "./storage.js";

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
  const rootPath = path.resolve(input.rootPath);
  assertSafeId("session id", input.sessionId);
  assertCommandInput(input);

  ensureLocalProjectBootstrapped({
    rootPath,
    now,
    gitBinary: input.gitBinary,
    migrationsDir: input.migrationsDir
  });

  const snapshot = createGitRepoSnapshot({ rootPath, createdAt: now, gitBinary: input.gitBinary });
  const layout = ensureLocalProjectLayout(snapshot.rootPath);
  const config = readLocalProjectConfig(layout.configPath);
  if (!config) throw new Error("Grape config is missing. Run grape init --connect.");
  if (path.resolve(config.project.rootPath) !== snapshot.rootPath) {
    throw new Error("Grape config root path does not match the current repository path.");
  }

  const cwd = normalizeRepoRelativePath(snapshot.rootPath, input.cwd, "cwd");
  const testFiles =
    sourceType === "test_run"
      ? ((input as RecordLocalTestResultInput).testFiles ?? []).map((file) =>
          normalizeRepoRelativePath(snapshot.rootPath, file, "test file")
        )
      : [];

  const databaseResult = withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database) {
      const repositories = createStorageRepositories(database);
      const evidenceRepositories = createEvidenceStorageRepositories(database);
      const indexingRepositories = createIndexingStorageRepositories(database);
      const snapshotResult = persistGitRepoSnapshot({
        database,
        repositories,
        evidenceRepositories,
        indexingRepositories,
        rootPath: snapshot.rootPath,
        projectId: config.project.projectId,
        repoId: config.project.repoId,
        gitBinary: input.gitBinary,
        now
      });
      const session = repositories.contextSessions.get(input.sessionId);
      if (!session) {
        throw new Error("context session not found. Call grape_get_context before recording agent evidence.");
      }
      if (session.repoId !== config.project.repoId) throw new Error("context session repo does not match this project.");
      if (
        session.branchName !== snapshotResult.snapshot.branch ||
        session.headCommitSha !== snapshotResult.snapshot.commit
      ) {
        throw new Error("context session is stale. Call grape_get_context before recording agent evidence.");
      }

      const observation =
        sourceType === "command_run"
          ? buildAgentCommandObservationSource({
              ...baseObservationInput(input, config.project.projectId, config.project.repoId, snapshotResult, cwd, now)
            })
          : buildAgentTestObservationSource({
              ...baseObservationInput(input, config.project.projectId, config.project.repoId, snapshotResult, cwd, now),
              passed: (input as RecordLocalTestResultInput).passed,
              testFramework: normalizedOptionalString((input as RecordLocalTestResultInput).testFramework),
              testFiles
            });
      const inserted = evidenceRepositories.sources.insertOrIgnore(observation.source);
      return { observation, inserted };
    }
  });

  return {
    rootPath: snapshot.rootPath,
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
  projectId: string,
  repoId: string,
  snapshotResult: ReturnType<typeof persistGitRepoSnapshot>,
  cwd: string,
  now: string
) {
  return {
    projectId,
    repoId,
    snapshotId: snapshotResult.snapshotId,
    sessionId: input.sessionId,
    branch: snapshotResult.snapshot.branch,
    commit: snapshotResult.snapshot.commit,
    worktreeHash: snapshotResult.snapshot.worktreeHash,
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
