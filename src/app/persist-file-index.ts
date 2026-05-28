import type { RepoSnapshot } from "../core/git/index.js";
import { buildFileIndex, buildLexicalIndex } from "../core/indexing/index.js";
import type {
  EvidenceStorageRepositories,
  FtsEntryRecord,
  FtsEntryInsertRecord,
  IndexingStorageRepositories,
  SymbolEdgeRecord,
  SymbolNodeRecord
} from "../core/storage/index.js";

export interface PersistFileIndexInput {
  readonly evidenceRepositories: EvidenceStorageRepositories;
  readonly indexingRepositories: IndexingStorageRepositories;
  readonly projectId: string;
  readonly snapshot: RepoSnapshot;
  readonly now: string;
}

export interface PersistFileIndexResult {
  readonly nodesSeen: number;
  readonly nodesInserted: number;
  readonly edgesSeen: number;
  readonly edgesInserted: number;
  readonly ftsEntriesSeen: number;
  readonly ftsEntriesInserted: number;
  readonly skippedFiles: number;
  readonly ftsSkippedSources: number;
}

export function persistFileIndex(input: PersistFileIndexInput): PersistFileIndexResult {
  const sources = input.evidenceRepositories.sources.listBySnapshot(input.snapshot.snapshotId);
  const sourceIdByPath = new Map(sources.map((source) => [source.sourceRef, source.sourceId]));
  const index = buildFileIndex({
    projectId: input.projectId,
    repoId: input.snapshot.repoId,
    snapshotId: input.snapshot.snapshotId,
    rootPath: input.snapshot.rootPath,
    files: input.snapshot.files.map((file) => {
      const sourceId = sourceIdByPath.get(file.path);
      if (!sourceId) {
        throw new Error(`file index requires source evidence for ${file.path}`);
      }
      return { ...file, sourceId };
    }),
    createdAt: input.now
  });
  const lexicalIndex = buildLexicalIndex({
    projectId: input.projectId,
    repoId: input.snapshot.repoId,
    snapshotId: input.snapshot.snapshotId,
    rootPath: input.snapshot.rootPath,
    sources,
    createdAt: input.now
  });

  let nodesInserted = 0;
  let edgesInserted = 0;
  let ftsEntriesInserted = 0;

  for (const node of index.nodes) {
    const record: SymbolNodeRecord = {
      ...node,
      metadataJson: JSON.stringify(node.metadata)
    };
    if (input.indexingRepositories.symbolNodes.insertOrIgnore(record)) {
      nodesInserted += 1;
    } else {
      assertMatchingNode(input.indexingRepositories.symbolNodes.get(record.symbolId), record);
    }
  }

  for (const edge of index.edges) {
    const record: SymbolEdgeRecord = {
      ...edge,
      metadataJson: JSON.stringify(edge.metadata)
    };
    if (input.indexingRepositories.symbolEdges.insertOrIgnore(record)) {
      edgesInserted += 1;
    } else {
      assertMatchingEdge(input.indexingRepositories.symbolEdges.get(record.edgeId), record);
    }
  }

  for (const entry of lexicalIndex.entries) {
    const record: FtsEntryInsertRecord = {
      ...entry,
      metadataJson: JSON.stringify(entry.metadata)
    };
    if (input.indexingRepositories.ftsEntries.insertOrIgnore(record)) {
      ftsEntriesInserted += 1;
    } else {
      assertMatchingFtsEntry(input.indexingRepositories.ftsEntries.get(record.ftsEntryId), record);
    }
  }

  return {
    nodesSeen: index.nodes.length,
    nodesInserted,
    edgesSeen: index.edges.length,
    edgesInserted,
    ftsEntriesSeen: lexicalIndex.entries.length,
    ftsEntriesInserted,
    skippedFiles: index.skipped.length,
    ftsSkippedSources: lexicalIndex.skipped.length
  };
}

function assertMatchingFtsEntry(existing: FtsEntryRecord | undefined, next: FtsEntryInsertRecord): void {
  if (!existing) {
    throw new Error(`fts entry insert conflict without stored row: ${next.ftsEntryId}`);
  }

  assertField("fts entry project", existing.projectId, next.projectId);
  assertField("fts entry repo", existing.repoId, next.repoId);
  assertField("fts entry snapshot", existing.snapshotId, next.snapshotId);
  assertField("fts entry source", existing.sourceId, next.sourceId);
  assertField("fts entry ref", existing.sourceRef, next.sourceRef);
  assertField("fts entry source type", existing.sourceType, next.sourceType);
  assertField("fts entry source hash", existing.sourceHash, next.sourceHash);
  assertField("fts entry text hash", existing.textHash, next.textHash);
  assertField("fts entry metadata", existing.metadataJson, next.metadataJson);
}

function assertMatchingNode(existing: SymbolNodeRecord | undefined, next: SymbolNodeRecord): void {
  if (!existing) {
    throw new Error(`symbol node insert conflict without stored row: ${next.symbolId}`);
  }

  assertField("symbol node project", existing.projectId, next.projectId);
  assertField("symbol node repo", existing.repoId, next.repoId);
  assertField("symbol node snapshot", existing.snapshotId, next.snapshotId);
  assertField("symbol node source", existing.sourceId, next.sourceId);
  assertField("symbol node path", existing.path, next.path);
  assertField("symbol node language", existing.language, next.language);
  assertField("symbol node name", existing.name, next.name);
  assertField("symbol node kind", existing.symbolKind, next.symbolKind);
  assertNumberField("symbol node start line", existing.startLine, next.startLine);
  assertNumberField("symbol node end line", existing.endLine, next.endLine);
  assertField("symbol node body hash", existing.bodyHash, next.bodyHash);
  assertField("symbol node signature hash", existing.signatureHash, next.signatureHash);
  assertField("symbol node confidence", existing.confidence, next.confidence);
  assertField("symbol node metadata", existing.metadataJson, next.metadataJson);
}

function assertMatchingEdge(existing: SymbolEdgeRecord | undefined, next: SymbolEdgeRecord): void {
  if (!existing) {
    throw new Error(`symbol edge insert conflict without stored row: ${next.edgeId}`);
  }

  assertField("symbol edge project", existing.projectId, next.projectId);
  assertField("symbol edge repo", existing.repoId, next.repoId);
  assertField("symbol edge snapshot", existing.snapshotId, next.snapshotId);
  assertField("symbol edge from", existing.fromSymbolId, next.fromSymbolId);
  assertField("symbol edge to", existing.toSymbolId, next.toSymbolId);
  assertField("symbol edge ref", existing.toRef, next.toRef);
  assertField("symbol edge type", existing.edgeType, next.edgeType);
  assertField("symbol edge confidence", existing.confidence, next.confidence);
  assertField("symbol edge discovery method", existing.discoveryMethod, next.discoveryMethod);
  assertField("symbol edge metadata", existing.metadataJson, next.metadataJson);
}

function assertField(label: string, existing: string | undefined, next: string | undefined): void {
  if (existing !== next) {
    throw new Error(`${label} mismatch while persisting file index`);
  }
}

function assertNumberField(label: string, existing: number, next: number): void {
  if (existing !== next) {
    throw new Error(`${label} mismatch while persisting file index`);
  }
}
