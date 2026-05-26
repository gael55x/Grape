import { restoreOmittedContext } from "../app/local-project/index.js";
import type { RestoreOmittedContextResult } from "../app/local-project/index.js";

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
  assertAllowedFields(input, ["sessionId", "restoreToken"]);
  return {
    sessionId: requiredString(input.sessionId, "sessionId"),
    restoreToken: requiredString(input.restoreToken, "restoreToken")
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function assertAllowedFields(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new Error(`unsupported grape_get_omitted_item argument: ${key}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitRootPath(result: RestoreOmittedContextResult): GrapeGetOmittedItemOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
