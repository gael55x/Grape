import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface BenchmarkFixtureMetadata {
  readonly benchmarkTask: string;
}

export function readBenchmarkFixtureMetadata(fixturePath: string): BenchmarkFixtureMetadata {
  const resolvedFixturePath = path.resolve(fixturePath);
  if (!existsSync(resolvedFixturePath)) {
    throw new Error(
      `Benchmark fixture not found at ${resolvedFixturePath}. Try grape bench --fixture <name> (default: tests/fixtures/<name>) or --fixture-path <path>.`
    );
  }
  const metadataPath = path.join(resolvedFixturePath, "grape-fixture.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(metadataPath, "utf8"));
  } catch {
    throw new Error(
      `Missing or invalid grape-fixture.json in ${resolvedFixturePath}. Add a benchmarkTask field or pass --task <text>.`
    );
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
