import { readFileSync } from "node:fs";
import path from "node:path";

import { getLocalArtifact } from "../app/local-project/index.js";
import type { GetLocalArtifactResult } from "../app/local-project/index.js";

const artifactOutputModes = ["metadata", "full"] as const;
type GrapeGetArtifactOutputMode = (typeof artifactOutputModes)[number];

export interface GrapeGetArtifactInput {
  readonly artifactId: string;
  readonly outputMode?: GrapeGetArtifactOutputMode;
}

export type GrapeGetArtifactOutput = Omit<GetLocalArtifactResult, "rootPath"> & {
  readonly outputMode: GrapeGetArtifactOutputMode;
  readonly artifactBody?: unknown;
};

export function runGrapeGetArtifactTool(input: unknown, rootPath: string): GrapeGetArtifactOutput {
  const parsed = parseInput(input);
  const outputMode = parsed.outputMode ?? "metadata";
  const artifact = getLocalArtifact({ rootPath, artifactId: parsed.artifactId });
  const output: GrapeGetArtifactOutput = {
    ...omitRootPath(artifact),
    outputMode
  };

  if (outputMode === "full") {
    return {
      ...output,
      artifactBody: readStoredArtifactBody(rootPath, artifact)
    };
  }

  return output;
}

function parseInput(input: unknown): GrapeGetArtifactInput {
  if (!isRecord(input)) throw new Error("grape_get_artifact arguments must be an object");
  assertAllowedFields(input, ["artifactId", "outputMode"]);
  return {
    artifactId: requiredString(input.artifactId, "artifactId"),
    outputMode: optionalOutputMode(input.outputMode)
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

function optionalOutputMode(value: unknown): GrapeGetArtifactOutputMode | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !artifactOutputModes.includes(value as GrapeGetArtifactOutputMode)) {
    throw new Error("outputMode must be metadata or full");
  }
  return value as GrapeGetArtifactOutputMode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitRootPath(result: GetLocalArtifactResult): GrapeGetArtifactOutput {
  const { rootPath: _rootPath, ...safeResult } = result;
  return { ...safeResult, outputMode: "metadata" };
}

function readStoredArtifactBody(rootPath: string, artifact: GetLocalArtifactResult): unknown {
  if (!artifact.artifactFiles.jsonExists) {
    throw new Error(`stored artifact JSON is missing: ${artifact.artifactId}`);
  }
  const artifactPath = safeRepoPath(rootPath, artifact.artifactFiles.json);
  return JSON.parse(readFileSync(artifactPath, "utf8")) as unknown;
}

function safeRepoPath(rootPath: string, repoRelativePath: string): string {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedPath = path.resolve(resolvedRoot, repoRelativePath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("stored artifact path escapes repository root");
  }
  return resolvedPath;
}
