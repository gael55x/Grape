import { listLocalProofs } from "../app/local-project/index.js";
import type { ListLocalProofsResult } from "../app/local-project/index.js";
import { assertAllowedFields, isRecord, optionalNonEmptyString } from "./tool-input.js";

export interface GrapeGetProofsInput {
  readonly proofId?: string;
  readonly sourceId?: string;
}

export type GrapeGetProofsOutput = Omit<ListLocalProofsResult, "rootPath">;

export function runGrapeGetProofsTool(input: unknown, rootPath: string): GrapeGetProofsOutput {
  const parsed = parseInput(input);
  return omitRootPath(
    listLocalProofs({
      rootPath,
      proofId: parsed.proofId,
      sourceId: parsed.sourceId
    })
  );
}

function parseInput(input: unknown): GrapeGetProofsInput {
  if (!isRecord(input)) throw new Error("grape_get_proofs arguments must be an object");
  assertAllowedFields(input, ["proofId", "sourceId"], "grape_get_proofs");
  return {
    proofId: optionalNonEmptyString(input, "proofId"),
    sourceId: optionalNonEmptyString(input, "sourceId")
  };
}

function omitRootPath(result: ListLocalProofsResult): GrapeGetProofsOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
