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
    checksumSha256: "b0e5527108c77a2f86c9cd5089fda827a431a4f1db29c5e5989c82586a377ec1",
    description: "Create the alpha storage subset for project, repo, evidence, claim, artifact, and session ledgers."
  }
] as const satisfies readonly StorageMigrationReference[];

export type StorageMigrationId = (typeof storageMigrationReferences)[number]["id"];
