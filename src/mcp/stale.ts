import { listLocalStaleItems } from "../app/local-project/index.js";
import type { ListLocalStaleItemsResult } from "../app/local-project/stale.js";

export interface GrapeGetStaleItemsInput {
  readonly sessionId?: string;
}

export type GrapeGetStaleItemsOutput = Omit<ListLocalStaleItemsResult, "rootPath">;

export function runGrapeGetStaleItemsTool(input: unknown, rootPath: string): GrapeGetStaleItemsOutput {
  const parsed = parseInput(input);
  return omitRootPath(
    listLocalStaleItems({
      rootPath,
      sessionId: parsed.sessionId
    })
  );
}

function parseInput(input: unknown): GrapeGetStaleItemsInput {
  if (!isRecord(input)) throw new Error("grape_get_stale_items arguments must be an object");
  assertAllowedFields(input, ["sessionId"]);
  return {
    sessionId: optionalString(input.sessionId, "sessionId")
  };
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value;
}

function assertAllowedFields(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new Error(`unsupported grape_get_stale_items argument: ${key}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitRootPath(result: ListLocalStaleItemsResult): GrapeGetStaleItemsOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
