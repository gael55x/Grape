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
    checksumSha256: "1467a75c59ddd2ce5240c27c3fda339ddb2d625a658a9e4974a682b650ade236",
    description: "Create the alpha storage subset for project, repo, evidence, claim, artifact, and session ledgers."
  }
] as const satisfies readonly StorageMigrationReference[];

export type StorageMigrationId = (typeof storageMigrationReferences)[number]["id"];
