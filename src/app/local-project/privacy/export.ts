import {
  createPrivacyStorageRepositories,
  type LocalDataInventoryCounts
} from "../../../core/storage/index.js";
import { ensureConfiguredLocalProjectLayout } from "../setup/configured-layout.js";
import { withMigratedLocalDatabase } from "../setup/storage.js";
import {
  measureStorageFootprint,
  type StorageFootprint
} from "../maintenance/storage-footprint.js";

export interface ExportLocalProjectInventoryInput {
  readonly rootPath: string;
  readonly now?: string;
  readonly migrationsDir?: string;
}

export interface ExportLocalProjectInventoryResult {
  readonly formatVersion: 1;
  readonly exportedAt: string;
  readonly rootPath: string;
  readonly databasePath: string;
  readonly migrationsApplied: readonly string[];
  readonly storageFootprint: StorageFootprint;
  readonly rowCounts: LocalDataInventoryCounts;
  readonly dataClasses: readonly ExportDataClass[];
  readonly sourceTextStorage: {
    readonly ftsEntryTextRows: number;
    readonly contextArtifactRows: number;
    readonly artifactJsonBytes: number;
    readonly artifactMarkdownBytes: number;
    readonly artifactRepositoryBytes: number;
    readonly storesAllowedSourceTextForLexicalSearch: boolean;
    readonly storesRenderedContextExcerpts: boolean;
  };
  readonly omittedFromExport: readonly string[];
  readonly notes: readonly string[];
}

export interface ExportDataClass {
  readonly id: string;
  readonly rows: number;
  readonly mayContainSourceText: boolean;
  readonly exportedDetail: string;
}

export function exportLocalProjectInventory(
  input: ExportLocalProjectInventoryInput
): ExportLocalProjectInventoryResult {
  const exportedAt = input.now ?? new Date().toISOString();
  const { layout } = ensureConfiguredLocalProjectLayout(input.rootPath);
  const footprintInput = {
    grapeDirPath: layout.grapeDirPath,
    databasePath: layout.databasePath,
    artifactDirPath: layout.artifactDirPath
  };

  const databaseResult = withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => exportedAt,
    operation(database) {
      const privacy = createPrivacyStorageRepositories(database);
      return privacy.countLocalDataRows();
    }
  });
  const rowCounts = databaseResult.value;
  const storageFootprint = measureStorageFootprint(footprintInput);

  return {
    formatVersion: 1,
    exportedAt,
    rootPath: layout.rootPath,
    databasePath: layout.databasePath,
    migrationsApplied: databaseResult.migrationResult.applied.map((migration) => migration.id),
    storageFootprint,
    rowCounts,
    dataClasses: dataClasses(rowCounts),
    sourceTextStorage: {
      ftsEntryTextRows: rowCounts.indexes.ftsEntryText,
      contextArtifactRows: rowCounts.context.contextArtifacts,
      artifactJsonBytes: storageFootprint.artifactJsonBytes,
      artifactMarkdownBytes: storageFootprint.artifactMarkdownBytes,
      artifactRepositoryBytes: storageFootprint.artifactRepositoryBytes,
      storesAllowedSourceTextForLexicalSearch: rowCounts.indexes.ftsEntryText > 0,
      storesRenderedContextExcerpts: rowCounts.context.contextArtifacts > 0
    },
    omittedFromExport: [
      "raw repository source file bodies",
      "raw FTS text bodies from fts_entry_text",
      "raw context artifact JSON and Markdown bodies",
      "raw artifact repository backing files",
      "SQLite database bytes and sidecar bytes",
      "raw command stdout and stderr bodies",
      "ignored, private, or scanner-rejected file contents"
    ],
    notes: [
      "This export is a local inventory, not a database dump.",
      "It may apply missing storage migrations before it reads the inventory.",
      "It does not delete, compact, or purge local Grape data.",
      "Use grape compact to preview retention cleanup before deleting eligible rows and artifact files."
    ]
  };
}

function dataClasses(rowCounts: LocalDataInventoryCounts): ExportDataClass[] {
  return [
    {
      id: "setup",
      rows: sumValues(rowCounts.setup),
      mayContainSourceText: false,
      exportedDetail: "schema, project, and repository row counts"
    },
    {
      id: "repository_state",
      rows: sumValues(rowCounts.repositoryState),
      mayContainSourceText: false,
      exportedDetail: "snapshot, worktree, source metadata, and rejection row counts"
    },
    {
      id: "trust",
      rows: sumValues(rowCounts.trust),
      mayContainSourceText: false,
      exportedDetail: "claim, proof, rule, and trust-edge row counts"
    },
    {
      id: "indexes",
      rows: sumValues(rowCounts.indexes),
      mayContainSourceText: rowCounts.indexes.ftsEntryText > 0,
      exportedDetail: "symbol index row counts and FTS text row count only"
    },
    {
      id: "context",
      rows: sumValues(rowCounts.context),
      mayContainSourceText: rowCounts.context.contextArtifacts > 0,
      exportedDetail: "session, artifact, sent, omitted, dependency, and pack item row counts"
    },
    {
      id: "compression",
      rows: sumValues(rowCounts.compression),
      mayContainSourceText: false,
      exportedDetail: "compression artifact and compact input metadata row counts"
    },
    {
      id: "audit",
      rows: sumValues(rowCounts.audit),
      mayContainSourceText: false,
      exportedDetail: "audit row count"
    }
  ];
}

function sumValues(values: Readonly<Record<string, number>>): number {
  return Object.values(values).reduce((total, value) => total + value, 0);
}
