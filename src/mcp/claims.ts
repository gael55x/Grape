import { listLocalClaims } from "../app/local-project/index.js";
import type { ListLocalClaimsResult } from "../app/local-project/index.js";

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
  assertAllowedFields(input, ["activeOnly"]);
  return {
    activeOnly: optionalBoolean(input.activeOnly, "activeOnly")
  };
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${field} must be a boolean`);
  return value;
}

function assertAllowedFields(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new Error(`unsupported grape_get_claims argument: ${key}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitRootPath(result: ListLocalClaimsResult): GrapeGetClaimsOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
