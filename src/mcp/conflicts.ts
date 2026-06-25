import { listLocalConflicts } from "../app/local-project/index.js";
import type { ListLocalConflictsResult } from "../app/local-project/inspection/conflicts.js";
import { assertAllowedFields, isRecord } from "./tool-input.js";

export interface GrapeGetConflictsInput {}

export type GrapeGetConflictsOutput = Omit<ListLocalConflictsResult, "rootPath">;

export function runGrapeGetConflictsTool(input: unknown, rootPath: string): GrapeGetConflictsOutput {
  parseInput(input);
  return omitRootPath(listLocalConflicts({ rootPath }));
}

function parseInput(input: unknown): GrapeGetConflictsInput {
  if (!isRecord(input)) throw new Error("grape_get_conflicts arguments must be an object");
  assertAllowedFields(input, [], "grape_get_conflicts");
  return {};
}

function omitRootPath(result: ListLocalConflictsResult): GrapeGetConflictsOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
