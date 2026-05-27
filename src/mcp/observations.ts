import {
  recordLocalCommandResult,
  recordLocalTestResult
} from "../app/local-project/index.js";
import type {
  RecordLocalCommandResultInput,
  RecordLocalObservationResult,
  RecordLocalTestResultInput
} from "../app/local-project/observations.js";
import {
  assertAllowedFields,
  assertReportedByAgent,
  isRecord,
  optionalString,
  optionalStringArray,
  requiredBoolean,
  requiredInteger,
  requiredString
} from "./tool-input.js";

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
  ], "observation");
  assertReportedByAgent(input.reportedBy, "reportedBy must be agent for MCP observation writes");
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
  ], "observation");
  assertReportedByAgent(input.reportedBy, "reportedBy must be agent for MCP observation writes");
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

function omitRootPath(result: RecordLocalObservationResult): GrapeRecordObservationOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
