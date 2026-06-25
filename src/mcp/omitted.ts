import { restoreOmittedContext } from "../app/local-project/index.js";
import type { RestoreOmittedContextResult } from "../app/local-project/index.js";
import { assertAllowedFields, isRecord, requiredString } from "./tool-input.js";

export interface GrapeGetOmittedItemInput {
  readonly sessionId: string;
  readonly restoreToken: string;
}

export type GrapeGetOmittedItemOutput = Omit<RestoreOmittedContextResult, "rootPath">;

export function runGrapeGetOmittedItemTool(input: unknown, rootPath: string): GrapeGetOmittedItemOutput {
  const parsed = parseInput(input);
  return omitRootPath(restoreOmittedContext({
    rootPath,
    sessionId: parsed.sessionId,
    restoreToken: parsed.restoreToken
  }));
}

function parseInput(input: unknown): GrapeGetOmittedItemInput {
  if (!isRecord(input)) throw new Error("grape_get_omitted_item arguments must be an object");
  assertAllowedFields(input, ["sessionId", "restoreToken"], "grape_get_omitted_item");
  return {
    sessionId: requiredString(input, "sessionId"),
    restoreToken: requiredString(input, "restoreToken")
  };
}

function omitRootPath(result: RestoreOmittedContextResult): GrapeGetOmittedItemOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
