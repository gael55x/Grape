import { existsSync, readFileSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import type { StorageMigrationSource } from "../../../core/storage/index.js";
import { applyStorageMigrations, storageMigrationReferences } from "../../../core/storage/index.js";

export interface LocalDatabaseResult<T> {
  readonly databasePath: string;
  readonly migrationResult: ReturnType<typeof applyStorageMigrations>;
  readonly value: T;
}

export interface RepairableLocalDatabaseResult<T> extends LocalDatabaseResult<T> {
  readonly databaseBackupPath?: string;
  readonly sidecarBackupPaths?: readonly string[];
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

export function withRepairableMigratedLocalDatabase<T>(input: {
  readonly databasePath: string;
  readonly now: () => string;
  readonly migrationsDir?: string;
  readonly operation: (database: DatabaseSync) => T;
}): RepairableLocalDatabaseResult<T> {
  try {
    return withMigratedLocalDatabase(input);
  } catch (error) {
    if (!existsSync(input.databasePath) || !isRepairableLocalDatabaseError(error)) {
      throw error;
    }

    const repair = backupRepairableLocalDatabase(input.databasePath, input.now());
    return {
      ...withMigratedLocalDatabase(input),
      databaseBackupPath: repair.databaseBackupPath,
      sidecarBackupPaths: repair.sidecarBackupPaths
    };
  }
}

export function readStorageMigrationSources(migrationsDir = resolveStorageMigrationsDir()): StorageMigrationSource[] {
  return storageMigrationReferences.map((migration) => ({
    ...migration,
    sql: readFileSync(path.join(migrationsDir, migration.filename), "utf8")
  }));
}

export function isRepairableLocalDatabaseError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("file is not a database") ||
    message.includes("database disk image is malformed") ||
    message.includes("refusing to apply migrations to a non-empty database without schema_migrations")
  );
}

function backupRepairableLocalDatabase(databasePath: string, now: string): {
  readonly databaseBackupPath: string;
  readonly sidecarBackupPaths: readonly string[];
} {
  const databaseBackupPath = uniqueDatabaseBackupPath(databasePath, now);
  renameSync(databasePath, databaseBackupPath);

  const sidecarBackupPaths: string[] = [];
  for (const suffix of ["-wal", "-shm"]) {
    const sidecarPath = `${databasePath}${suffix}`;
    if (!existsSync(sidecarPath)) continue;

    const sidecarBackupPath = `${databaseBackupPath}${suffix}`;
    renameSync(sidecarPath, sidecarBackupPath);
    sidecarBackupPaths.push(sidecarBackupPath);
  }

  return { databaseBackupPath, sidecarBackupPaths };
}

function uniqueDatabaseBackupPath(databasePath: string, now: string): string {
  const directory = path.dirname(databasePath);
  const stamp = now.replace(/[^0-9A-Za-z.-]/g, "-");
  const base = path.join(directory, `${path.basename(databasePath)}.invalid.${stamp}`);

  if (!existsSync(base)) return base;

  for (let index = 1; index < 1000; index += 1) {
    const candidate = path.join(directory, `${path.basename(databasePath)}.invalid.${stamp}.${index}`);
    if (!existsSync(candidate)) return candidate;
  }

  throw new Error("could not create a unique backup path for invalid Grape database.");
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
