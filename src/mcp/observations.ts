import {
  recordLocalCommandResult,
  recordLocalTestResult
} from "../app/local-project/index.js";
import type {
  RecordLocalCommandResultInput,
  RecordLocalObservationResult,
  RecordLocalTestResultInput
} from "../app/local-project/observations.js";

type GrapeRecordObservationOutput = Omit<RecordLocalObservationResult, "rootPath">;

export function runGrapeRecordCommandResultTool(input: unknown, rootPath: string): GrapeRecordObservationOutput {
  return omitRootPath(recordLocalCommandResult({ ...parseCommandInput(input), rootPath }));
}

export function runGrapeRecordTestResultTool(input: unknown, rootPath: string): GrapeRecordObservationOutput {
  return omitRootPath(recordLocalTestResult({ ...parseTestInput(input), rootPath }));
}

function parseCommandInput(input: unknown): Omit<RecordLocalCommandResultInput, "rootPath"> {
  if (!isRecord(input)) throw new Error("grape_record_command_result arguments must be an object");
  assertAllowedFields(input, [
    "sessionId",
    "command",
    "commandHash",
    "cwd",
    "exitCode",
    "stdoutHash",
    "stderrHash",
    "startedAt",
    "endedAt",
    "reportedBy"
  ]);
  assertReportedByAgent(input.reportedBy);
  return commandFields(input);
}

function parseTestInput(input: unknown): Omit<RecordLocalTestResultInput, "rootPath"> {
  if (!isRecord(input)) throw new Error("grape_record_test_result arguments must be an object");
  assertAllowedFields(input, [
    "sessionId",
    "command",
    "commandHash",
    "cwd",
    "exitCode",
    "stdoutHash",
    "stderrHash",
    "startedAt",
    "endedAt",
    "reportedBy",
    "passed",
    "testFramework",
    "testFiles"
  ]);
  assertReportedByAgent(input.reportedBy);
  return {
    ...commandFields(input),
    passed: requiredBoolean(input, "passed"),
    testFramework: optionalString(input, "testFramework"),
    testFiles: optionalStringArray(input, "testFiles")
  };
}

function commandFields(input: Record<string, unknown>): Omit<RecordLocalCommandResultInput, "rootPath"> {
  return {
    sessionId: requiredString(input, "sessionId"),
    command: requiredString(input, "command"),
    commandHash: requiredString(input, "commandHash"),
    cwd: requiredString(input, "cwd"),
    exitCode: requiredInteger(input, "exitCode"),
    stdoutHash: requiredString(input, "stdoutHash"),
    stderrHash: requiredString(input, "stderrHash"),
    startedAt: requiredString(input, "startedAt"),
    endedAt: requiredString(input, "endedAt")
  };
}

function assertAllowedFields(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new Error(`unsupported observation argument: ${key}`);
  }
}

function assertReportedByAgent(value: unknown): void {
  if (value === undefined) return;
  if (value !== "agent") throw new Error("reportedBy must be agent for MCP observation writes");
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || field.trim() === "") throw new Error(`${key} must be a non-empty string`);
  return field;
}

function optionalString(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (typeof field !== "string") throw new Error(`${key} must be a string`);
  return field;
}

function requiredInteger(value: Record<string, unknown>, key: string): number {
  const field = value[key];
  if (!Number.isInteger(field)) throw new Error(`${key} must be an integer`);
  return field as number;
}

function requiredBoolean(value: Record<string, unknown>, key: string): boolean {
  const field = value[key];
  if (typeof field !== "boolean") throw new Error(`${key} must be a boolean`);
  return field;
}

function optionalStringArray(value: Record<string, unknown>, key: string): string[] {
  const field = value[key];
  if (field === undefined) return [];
  if (!Array.isArray(field) || field.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${key} must be an array of non-empty strings`);
  }
  return field;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitRootPath(result: RecordLocalObservationResult): GrapeRecordObservationOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
