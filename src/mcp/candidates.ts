import {
  recordLocalCandidate,
  recordLocalUserDecision,
  requestLocalUserConfirmation
} from "../app/local-project/index.js";
import type {
  RecordLocalCandidateInput,
  RecordLocalCandidateResult,
  RecordLocalUserDecisionInput,
  RecordLocalUserDecisionResult,
  RequestLocalUserConfirmationInput,
  RequestLocalUserConfirmationResult
} from "../app/local-project/writes/candidates.js";
import {
  assertAllowedFields,
  assertReportedByAgent,
  isRecord,
  optionalString,
  requiredBoolean,
  requiredObject,
  requiredString
} from "./tool-input.js";

type GrapeRecordCandidateOutput = Omit<RecordLocalCandidateResult, "rootPath">;
type GrapeRecordUserDecisionOutput = Omit<RecordLocalUserDecisionResult, "rootPath">;
type GrapeRequestUserConfirmationOutput = Omit<RequestLocalUserConfirmationResult, "rootPath">;
type UserDecisionConfirmationChannel = RecordLocalUserDecisionInput["confirmationChannel"];

export function runGrapeRecordCandidateTool(input: unknown, rootPath: string): GrapeRecordCandidateOutput {
  return omitRootPath(recordLocalCandidate({ ...parseCandidateInput(input), rootPath }));
}

export function runGrapeRecordUserDecisionTool(input: unknown, rootPath: string): GrapeRecordUserDecisionOutput {
  return omitRootPath(recordLocalUserDecision({ ...parseUserDecisionInput(input), rootPath }));
}

export function runGrapeRequestUserConfirmationTool(
  input: unknown,
  rootPath: string
): GrapeRequestUserConfirmationOutput {
  return omitRootPath(requestLocalUserConfirmation({ ...parseConfirmationRequestInput(input), rootPath }));
}

function parseCandidateInput(input: unknown): Omit<RecordLocalCandidateInput, "rootPath"> {
  if (!isRecord(input)) throw new Error("grape_record_candidate arguments must be an object");
  assertAllowedFields(
    input,
    ["sessionId", "subject", "claimType", "claimText", "scope", "sourceId", "reportedBy"],
    "candidate"
  );
  assertReportedByAgent(input.reportedBy, "reportedBy must be agent for MCP candidate writes", true);
  return {
    sessionId: requiredString(input, "sessionId"),
    subject: requiredString(input, "subject"),
    claimType: requiredString(input, "claimType"),
    claimText: requiredString(input, "claimText"),
    scope: requiredObject(input, "scope"),
    sourceId: optionalString(input, "sourceId")
  };
}

function parseUserDecisionInput(input: unknown): Omit<RecordLocalUserDecisionInput, "rootPath"> {
  if (!isRecord(input)) throw new Error("grape_record_user_decision arguments must be an object");
  assertAllowedFields(
    input,
    [
      "sessionId",
      "prompt",
      "promptHash",
      "response",
      "responseHash",
      "confirmationChannel",
      "confirmedByUser",
      "confirmedAt",
      "scope",
      "reportedBy"
    ],
    "user decision"
  );
  assertReportedByAgent(input.reportedBy, "reportedBy must be agent for MCP user decision writes", true);
  return {
    sessionId: requiredString(input, "sessionId"),
    prompt: requiredString(input, "prompt"),
    promptHash: requiredString(input, "promptHash"),
    response: requiredString(input, "response"),
    responseHash: requiredString(input, "responseHash"),
    confirmationChannel: requiredConfirmationChannel(input.confirmationChannel),
    confirmedByUser: requiredBoolean(input, "confirmedByUser"),
    confirmedAt: requiredString(input, "confirmedAt"),
    scope: requiredObject(input, "scope")
  };
}

function parseConfirmationRequestInput(input: unknown): Omit<RequestLocalUserConfirmationInput, "rootPath"> {
  if (!isRecord(input)) throw new Error("grape_request_user_confirmation arguments must be an object");
  assertAllowedFields(input, ["sessionId", "prompt", "promptHash", "scope", "reason", "reportedBy"], "confirmation");
  assertReportedByAgent(input.reportedBy, "reportedBy must be agent for MCP confirmation requests", true);
  return {
    sessionId: requiredString(input, "sessionId"),
    prompt: requiredString(input, "prompt"),
    promptHash: requiredString(input, "promptHash"),
    scope: requiredObject(input, "scope"),
    reason: optionalString(input, "reason")
  };
}

function requiredConfirmationChannel(value: unknown): UserDecisionConfirmationChannel {
  if (value === "cli_prompt" || value === "mcp_user_confirmation" || value === "config_file" || value === "rule_file") {
    return value;
  }
  throw new Error("confirmationChannel must be cli_prompt, mcp_user_confirmation, config_file, or rule_file");
}

function omitRootPath<T extends { readonly rootPath: string }>(result: T): Omit<T, "rootPath"> {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
