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
  assertSortedById(available, "available");
  assertSortedById(applied, "applied");
  assertChecksums(available, "available");
  assertChecksums(applied, "applied");

  const availableById = new Map(available.map((migration) => [migration.id, migration]));
  const appliedById = new Map(applied.map((migration) => [migration.id, migration]));
  const alreadyApplied: StorageMigrationDefinition[] = [];
  const pending: StorageMigrationDefinition[] = [];

  for (const appliedMigration of applied) {
    const current = availableById.get(appliedMigration.id);
    if (!current) {
      throw new Error(`applied migration is not available: ${appliedMigration.id}`);
    }
    if (current.checksumSha256 !== appliedMigration.checksumSha256) {
      throw new Error(`applied migration checksum changed: ${appliedMigration.id}`);
    }
  }

  let seenPendingMigration = false;
  for (const migration of available) {
    if (appliedById.has(migration.id)) {
      if (seenPendingMigration) {
        throw new Error(`applied migrations must be a prefix of available migrations: ${migration.id}`);
      }
      alreadyApplied.push(migration);
    } else {
      seenPendingMigration = true;
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

function assertSortedById(migrations: readonly { readonly id: string }[], label: string): void {
  const sorted = [...migrations].sort((left, right) => left.id.localeCompare(right.id));
  for (let index = 0; index < migrations.length; index += 1) {
    if (migrations[index]?.id !== sorted[index]?.id) {
      throw new Error(`${label} migrations must be sorted by id`);
    }
  }
}

function assertChecksums(
  migrations: readonly { readonly id: string; readonly checksumSha256: string }[],
  label: string
): void {
  for (const migration of migrations) {
    if (!/^[a-f0-9]{64}$/.test(migration.checksumSha256)) {
      throw new Error(`${label} migration has invalid checksum: ${migration.id}`);
    }
  }
}
