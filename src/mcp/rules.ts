import { listLocalRules } from "../app/local-project/index.js";
import type { ListLocalRulesResult } from "../app/local-project/inspection/rules.js";

export interface GrapeGetRulesInput {}

export type GrapeGetRulesOutput = Omit<ListLocalRulesResult, "rootPath">;

export function runGrapeGetRulesTool(input: unknown, rootPath: string): GrapeGetRulesOutput {
  parseInput(input);
  return omitRootPath(listLocalRules({ rootPath }));
}

function parseInput(input: unknown): GrapeGetRulesInput {
  if (!isRecord(input)) throw new Error("grape_get_rules arguments must be an object");
  assertAllowedFields(input, []);
  return {};
}

function assertAllowedFields(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new Error(`unsupported grape_get_rules argument: ${key}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitRootPath(result: ListLocalRulesResult): GrapeGetRulesOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
