import { listLocalProofs } from "../app/local-project/index.js";
import type { ListLocalProofsResult } from "../app/local-project/index.js";

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
  assertAllowedFields(input, ["proofId", "sourceId"]);
  return {
    proofId: optionalString(input.proofId, "proofId"),
    sourceId: optionalString(input.sourceId, "sourceId")
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
    if (!allowedSet.has(key)) throw new Error(`unsupported grape_get_proofs argument: ${key}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitRootPath(result: ListLocalProofsResult): GrapeGetProofsOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
