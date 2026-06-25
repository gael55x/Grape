import { listLocalClaims } from "../app/local-project/index.js";
import type { ListLocalClaimsResult } from "../app/local-project/index.js";
import { assertAllowedFields, isRecord, optionalBoolean } from "./tool-input.js";

export interface GrapeGetClaimsInput {
  readonly activeOnly?: boolean;
}

export type GrapeGetClaimsOutput = Omit<ListLocalClaimsResult, "rootPath">;

export function runGrapeGetClaimsTool(input: unknown, rootPath: string): GrapeGetClaimsOutput {
  const parsed = parseInput(input);
  return omitRootPath(
    listLocalClaims({
      rootPath,
      activeOnly: parsed.activeOnly ?? true
    })
  );
}

function parseInput(input: unknown): GrapeGetClaimsInput {
  if (!isRecord(input)) throw new Error("grape_get_claims arguments must be an object");
  assertAllowedFields(input, ["activeOnly"], "grape_get_claims");
  return {
    activeOnly: optionalBoolean(input, "activeOnly")
  };
}

function omitRootPath(result: ListLocalClaimsResult): GrapeGetClaimsOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
