import { assertArtifactTextHasNoSecrets } from "../../../core/security/index.js";
import { sha256 } from "../context/compile-ids.js";
import type {
  RecordLocalCommandResultInput,
  RecordLocalGrapeObservedCommandResultInput,
  RecordLocalTestResultInput
} from "./types.js";

export function assertCommandInput(input: RecordLocalCommandResultInput | RecordLocalTestResultInput): void {
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
  if ("observedRunId" in input) {
    assertObservedRunId((input as RecordLocalGrapeObservedCommandResultInput).observedRunId);
  }
}

export function assertObservedRunId(value: string): string {
  if (typeof value !== "string" || !/^run:[a-f0-9]{24}$/i.test(value)) {
    throw new Error("observedRunId must be a Grape run id");
  }
  return value.toLowerCase();
}

export function normalizeSha256(label: string, value: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`${label} must be a SHA-256 hex digest`);
  }
  return value.toLowerCase();
}

export function assertExitCode(value: number): number {
  if (!Number.isInteger(value)) throw new Error("exitCode must be an integer");
  return value;
}

export function normalizeTimestamp(label: string, value: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be an ISO timestamp`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be an ISO timestamp`);
  return new Date(parsed).toISOString();
}

export function normalizedOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
