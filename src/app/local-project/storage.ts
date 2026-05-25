import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import type { StorageMigrationSource } from "../../core/storage/index.js";
import { applyStorageMigrations, storageMigrationReferences } from "../../core/storage/index.js";

export interface LocalDatabaseResult<T> {
  readonly databasePath: string;
  readonly migrationResult: ReturnType<typeof applyStorageMigrations>;
  readonly value: T;
}

export function withMigratedLocalDatabase<T>(input: {
  readonly databasePath: string;
  readonly now: () => string;
  readonly migrationsDir?: string;
  readonly operation: (database: DatabaseSync) => T;
}): LocalDatabaseResult<T> {
  const database = new DatabaseSync(input.databasePath);

  try {
    const migrationResult = applyStorageMigrations(
      database,
      readStorageMigrationSources(input.migrationsDir),
      input.now
    );
    return {
      databasePath: input.databasePath,
      migrationResult,
      value: input.operation(database)
    };
  } finally {
    database.close();
  }
}

export function readStorageMigrationSources(migrationsDir = resolveStorageMigrationsDir()): StorageMigrationSource[] {
  return storageMigrationReferences.map((migration) => ({
    ...migration,
    sql: readFileSync(path.join(migrationsDir, migration.filename), "utf8")
  }));
}

export function resolveStorageMigrationsDir(): string {
  const candidates = migrationDirectoryCandidates();
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`could not find Grape storage migrations. Checked: ${candidates.join(", ")}`);
  }
  return found;
}

function migrationDirectoryCandidates(): string[] {
  const candidates = new Set<string>();
  const envDir = process.env.GRAPE_MIGRATIONS_DIR;
  if (envDir) candidates.add(path.resolve(envDir));

  for (const ancestor of moduleAncestors()) {
    candidates.add(path.join(ancestor, "src", "core", "storage", "migrations"));
    candidates.add(path.join(ancestor, "core", "storage", "migrations"));
  }

  return [...candidates];
}

function moduleAncestors(): string[] {
  const start = path.dirname(fileURLToPath(import.meta.url));
  const ancestors = [];
  let current = start;

  while (true) {
    ancestors.push(current);
    const parent = path.dirname(current);
    if (parent === current) return ancestors;
    current = parent;
  }
}
