import { listLocalConflicts } from "../app/local-project/index.js";
import type { ListLocalConflictsResult } from "../app/local-project/conflicts.js";

export interface GrapeGetConflictsInput {}

export type GrapeGetConflictsOutput = Omit<ListLocalConflictsResult, "rootPath">;

export function runGrapeGetConflictsTool(input: unknown, rootPath: string): GrapeGetConflictsOutput {
  parseInput(input);
  return omitRootPath(listLocalConflicts({ rootPath }));
}

function parseInput(input: unknown): GrapeGetConflictsInput {
  if (!isRecord(input)) throw new Error("grape_get_conflicts arguments must be an object");
  assertAllowedFields(input, []);
  return {};
}

function assertAllowedFields(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new Error(`unsupported grape_get_conflicts argument: ${key}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitRootPath(result: ListLocalConflictsResult): GrapeGetConflictsOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
