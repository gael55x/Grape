import { listLocalRules } from "../app/local-project/index.js";
import type { ListLocalRulesResult } from "../app/local-project/inspection/rules.js";
import { assertAllowedFields, isRecord } from "./tool-input.js";

export interface GrapeGetRulesInput {}

export type GrapeGetRulesOutput = Omit<ListLocalRulesResult, "rootPath">;

export function runGrapeGetRulesTool(input: unknown, rootPath: string): GrapeGetRulesOutput {
  parseInput(input);
  return omitRootPath(listLocalRules({ rootPath }));
}

function parseInput(input: unknown): GrapeGetRulesInput {
  if (!isRecord(input)) throw new Error("grape_get_rules arguments must be an object");
  assertAllowedFields(input, [], "grape_get_rules");
  return {};
}

function omitRootPath(result: ListLocalRulesResult): GrapeGetRulesOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
