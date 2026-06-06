export interface StorageMigrationReference {
  readonly id: string;
  readonly filename: string;
  readonly checksumSha256: string;
  readonly compatibleChecksumSha256?: readonly string[];
  readonly description: string;
}

export const storageMigrationReferences = [
  {
    id: "0001",
    filename: "0001_initial_storage.sql",
    checksumSha256: "5f683fea7b7a5adc7d04fb21ee62cc28f2d6c6d1109262c680797bc4599a4c6b",
    description: "Create the initial storage tables for project, repo, evidence, claim, artifact, and session ledgers."
  },
  {
    id: "0002",
    filename: "0002_indexing_foundation.sql",
    checksumSha256: "2ea76abc48d83c660fb631c85f629465d32d75371f066e832934569ed7085590",
    description: "Create the file and symbol indexing foundation for module nodes and relationship edges."
  },
  {
    id: "0003",
    filename: "0003_fts_entries.sql",
    checksumSha256: "18c2ddc068433ffd2cdb523fe920d3ad63478b0bbd8ecddffc14ea06ced1f3cb",
    compatibleChecksumSha256: ["e23937d27051cb573f7e31264607ee4930e8cc8347ab62c183ae0807c06994d1"],
    description: "Create safe lexical source entry refs and text index rows."
  },
  {
    id: "0004",
    filename: "0004_compression_cache.sql",
    checksumSha256: "9f712aaacc32972c8e2d694197745b1e9c97bd49ca655679b9fc912caf64589e",
    description: "Create deterministic compression artifact and input hash cache tables."
  },
  {
    id: "0005",
    filename: "0005_context_performance_indexes.sql",
    checksumSha256: "70013da6ec154c753af733c5232833e049e3e8b9eacb3175fde4a5150e4a1318",
    description: "Add lookup indexes for context transport performance-critical session and lexical queries."
  },
  {
    id: "0006",
    filename: "0006_claim_edge_authority.sql",
    checksumSha256: "0ee25bfa8ed4d634477d84acab271a3cb6d47c582c613c93dbc27bf3c0b1bd76",
    description: "Create claim edge authority metadata for provenance-aware conflict and supersession policy."
  }
] as const satisfies readonly StorageMigrationReference[];

export type StorageMigrationId = (typeof storageMigrationReferences)[number]["id"];
