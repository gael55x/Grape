import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface BenchmarkFixtureMetadata {
  readonly benchmarkTask: string;
}

export function readBenchmarkFixtureMetadata(fixturePath: string): BenchmarkFixtureMetadata {
  const resolvedFixturePath = path.resolve(fixturePath);
  if (!existsSync(resolvedFixturePath)) {
    throw new Error("benchmark fixture not found");
  }
  const metadataPath = path.join(resolvedFixturePath, "grape-fixture.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(metadataPath, "utf8"));
  } catch {
    throw new Error("benchmark fixture metadata missing or invalid");
  }

  const benchmarkTask = taskFromMetadata(parsed);
  if (!benchmarkTask) {
    throw new Error("benchmark fixture metadata missing benchmarkTask");
  }

  return { benchmarkTask };
}

export function resolveBenchmarkTask(input: {
  readonly fixturePath: string;
  readonly task?: string;
}): string {
  const explicitTask = input.task?.trim();
  if (explicitTask) return explicitTask;
  return readBenchmarkFixtureMetadata(input.fixturePath).benchmarkTask;
}

function taskFromMetadata(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const task = (value as { readonly benchmarkTask?: unknown }).benchmarkTask;
  if (typeof task !== "string") return undefined;
  const normalized = task.trim();
  return normalized.length > 0 ? normalized : undefined;
}
