export interface StorageMigrationDefinition {
  readonly id: string;
  readonly filename: string;
  readonly checksumSha256: string;
}

export interface AppliedStorageMigration {
  readonly id: string;
  readonly filename: string;
  readonly checksumSha256: string;
  readonly appliedAt: string;
}

export interface StorageMigrationPlan {
  readonly alreadyApplied: readonly StorageMigrationDefinition[];
  readonly pending: readonly StorageMigrationDefinition[];
}

export function planPendingStorageMigrations(
  available: readonly StorageMigrationDefinition[],
  applied: readonly AppliedStorageMigration[]
): StorageMigrationPlan {
  assertUniqueMigrationIds(available, "available");
  assertUniqueMigrationIds(applied, "applied");
  assertSortedById(available);

  const availableById = new Map(available.map((migration) => [migration.id, migration]));
  const appliedById = new Map(applied.map((migration) => [migration.id, migration]));
  const alreadyApplied: StorageMigrationDefinition[] = [];
  const pending: StorageMigrationDefinition[] = [];

  for (const appliedMigration of applied) {
    const current = availableById.get(appliedMigration.id);
    if (!current) {
      throw new Error(`applied migration is not available: ${appliedMigration.id}`);
    }
    if (current.filename !== appliedMigration.filename) {
      throw new Error(`applied migration filename changed: ${appliedMigration.id}`);
    }
    if (current.checksumSha256 !== appliedMigration.checksumSha256) {
      throw new Error(`applied migration checksum changed: ${appliedMigration.id}`);
    }
  }

  for (const migration of available) {
    if (appliedById.has(migration.id)) {
      alreadyApplied.push(migration);
    } else {
      pending.push(migration);
    }
  }

  return { alreadyApplied, pending };
}

function assertUniqueMigrationIds(
  migrations: readonly { readonly id: string }[],
  label: string
): void {
  const seen = new Set<string>();
  for (const migration of migrations) {
    if (seen.has(migration.id)) {
      throw new Error(`duplicate ${label} migration id: ${migration.id}`);
    }
    seen.add(migration.id);
  }
}

function assertSortedById(migrations: readonly StorageMigrationDefinition[]): void {
  const sorted = [...migrations].sort((left, right) => left.id.localeCompare(right.id));
  for (let index = 0; index < migrations.length; index += 1) {
    if (migrations[index]?.id !== sorted[index]?.id) {
      throw new Error("available migrations must be sorted by id");
    }
  }
}
