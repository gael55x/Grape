import type { ExportLocalProjectInventoryResult } from "../../app/local-project/index.js";
import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, formatCommandFailure, repoOutputOptions, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";

export async function runExport(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--json", "--repo"]));
  if (flag) {
    writeError(`Unsupported option for grape export: ${flag}`);
    return exitCodes.usage;
  }

  try {
    const rootPath = repoPath(parsed);
    const { exportLocalProjectInventory } = await import("../../app/local-project/privacy/index.js");
    const result = exportLocalProjectInventory({ rootPath });
    const outputOptions = repoOutputOptions(rootPath, [result.rootPath]);

    if (parsed.flags.has("--json")) {
      writeJson(result, outputOptions);
      return exitCodes.ok;
    }

    write(renderExportResult(result), outputOptions);
    return exitCodes.ok;
  } catch (error) {
    const { recoveryGuidanceForErrorMessage } = await import("../../app/local-project/setup/recovery.js");
    writeError(
      formatCommandFailure("export", error, recoveryGuidanceForErrorMessage(errorMessage(error))),
      repoOutputOptions(repoPath(parsed))
    );
    return exitCodes.storage;
  }
}

function renderExportResult(result: ExportLocalProjectInventoryResult): string {
  const footprint = result.storageFootprint;
  const rows = result.rowCounts;
  return [
    "Grape export inventory.",
    "",
    `Exported at: ${result.exportedAt}`,
    `Database: ${result.databasePath}`,
    `Migrations applied: ${result.migrationsApplied.length === 0 ? "none" : result.migrationsApplied.join(", ")}`,
    "",
    "Storage footprint:",
    `  .grape bytes: ${footprint.grapeBytes}`,
    `  Database bytes: ${footprint.databaseBytes}`,
    `  WAL bytes: ${footprint.databaseWalBytes}`,
    `  SHM bytes: ${footprint.databaseShmBytes}`,
    `  Artifact bytes: ${footprint.artifactBytes}`,
    `  Artifact JSON bytes: ${footprint.artifactJsonBytes}`,
    `  Artifact Markdown bytes: ${footprint.artifactMarkdownBytes}`,
    `  Artifact repository bytes: ${footprint.artifactRepositoryBytes}`,
    `  Other bytes: ${footprint.otherBytes}`,
    "",
    "Row counts:",
    `  Setup: schema_migrations=${rows.setup.schemaMigrations}, projects=${rows.setup.projects}, repos=${rows.setup.repos}`,
    `  Repository state: repo_snapshots=${rows.repositoryState.repoSnapshots}, worktree_states=${rows.repositoryState.worktreeStates}, sources=${rows.repositoryState.sources}, source_rejections=${rows.repositoryState.sourceRejections}`,
    `  Trust: claims=${rows.trust.claims}, claim_candidates=${rows.trust.claimCandidates}, proofs=${rows.trust.proofs}, claim_edges=${rows.trust.claimEdges}, claim_edge_authority=${rows.trust.claimEdgeAuthority}, project_rules=${rows.trust.projectRules}`,
    `  Indexes: symbol_nodes=${rows.indexes.symbolNodes}, symbol_edges=${rows.indexes.symbolEdges}, fts_entries=${rows.indexes.ftsEntries}, fts_entry_text=${rows.indexes.ftsEntryText}`,
    `  Context: context_sessions=${rows.context.contextSessions}, session_events=${rows.context.sessionEvents}, context_artifacts=${rows.context.contextArtifacts}, context_dependencies=${rows.context.contextDependencies}, context_sent_items=${rows.context.contextSentItems}, omitted_context_items=${rows.context.omittedContextItems}, context_pack_items=${rows.context.contextPackItems}`,
    `  Compression: compression_artifacts=${rows.compression.compressionArtifacts}, compression_inputs=${rows.compression.compressionInputs}`,
    `  Audit: audit_events=${rows.audit.auditEvents}`,
    "",
    "Source text storage:",
    `  FTS text rows: ${result.sourceTextStorage.ftsEntryTextRows}`,
    `  Context artifact rows: ${result.sourceTextStorage.contextArtifactRows}`,
    `  Stores allowed source text for lexical search: ${result.sourceTextStorage.storesAllowedSourceTextForLexicalSearch ? "yes" : "no"}`,
    `  Stores rendered context excerpts: ${result.sourceTextStorage.storesRenderedContextExcerpts ? "yes" : "no"}`,
    "",
    "Export omits:",
    ...result.omittedFromExport.map((item) => `  - ${item}`),
    "",
    "Notes:",
    ...result.notes.map((note) => `  - ${note}`)
  ].join("\n");
}
