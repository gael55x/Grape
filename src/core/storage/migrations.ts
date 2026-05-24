export interface StorageMigrationReference {
  readonly id: string;
  readonly filename: string;
  readonly checksumSha256: string;
  readonly description: string;
}

export const storageMigrationReferences = [
  {
    id: "0001",
    filename: "0001_alpha_storage_subset.sql",
    checksumSha256: "5f683fea7b7a5adc7d04fb21ee62cc28f2d6c6d1109262c680797bc4599a4c6b",
    description: "Create the alpha storage subset for project, repo, evidence, claim, artifact, and session ledgers."
  }
] as const satisfies readonly StorageMigrationReference[];

export type StorageMigrationId = (typeof storageMigrationReferences)[number]["id"];
