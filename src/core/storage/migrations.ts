export interface StorageMigrationReference {
  readonly id: string;
  readonly filename: string;
  readonly description: string;
}

export const storageMigrationReferences = [
  {
    id: "0001",
    filename: "0001_alpha_storage_subset.sql",
    description: "Create the alpha storage subset for project, repo, evidence, claim, artifact, and session ledgers."
  }
] as const satisfies readonly StorageMigrationReference[];

export type StorageMigrationId = (typeof storageMigrationReferences)[number]["id"];
