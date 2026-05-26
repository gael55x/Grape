import { getLocalArtifact } from "../app/local-project/index.js";
import type { GetLocalArtifactResult } from "../app/local-project/index.js";

export interface GrapeGetArtifactInput {
  readonly artifactId: string;
}

export type GrapeGetArtifactOutput = Omit<GetLocalArtifactResult, "rootPath">;

export function runGrapeGetArtifactTool(input: unknown, rootPath: string): GrapeGetArtifactOutput {
  const parsed = parseInput(input);
  return omitRootPath(getLocalArtifact({ rootPath, artifactId: parsed.artifactId }));
}

function parseInput(input: unknown): GrapeGetArtifactInput {
  if (!isRecord(input)) throw new Error("grape_get_artifact arguments must be an object");
  assertAllowedFields(input, ["artifactId"]);
  return {
    artifactId: requiredString(input.artifactId, "artifactId")
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function assertAllowedFields(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new Error(`unsupported grape_get_artifact argument: ${key}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitRootPath(result: GetLocalArtifactResult): GrapeGetArtifactOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return safeResult;
}
