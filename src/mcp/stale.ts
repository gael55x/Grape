import { listLocalStaleItems } from "../app/local-project/index.js";
import type { ListLocalStaleItemsResult } from "../app/local-project/inspection/stale.js";
import { assertAllowedFields, isRecord, optionalNonEmptyString } from "./tool-input.js";

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
  assertAllowedFields(input, ["sessionId"], "grape_get_stale_items");
  return {
    sessionId: optionalNonEmptyString(input, "sessionId")
  };
}

function omitRootPath(result: ListLocalStaleItemsResult): GrapeGetStaleItemsOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
