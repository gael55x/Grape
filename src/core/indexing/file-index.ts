import { lstatSync, readFileSync } from "node:fs";

import type {
  SymbolConfidence,
  SymbolDiscoveryMethod,
  SymbolEdgeType,
  SymbolKind
} from "../storage/index.js";
import { hashStableParts, sha256 } from "./index-hash.js";
import { languageForPath, safeAbsolutePath } from "./index-paths.js";
import { importSpecifiers, resolveLocalImport } from "./import-resolution.js";
import { detectSymbolOnLine } from "./symbol-detection.js";

export interface FileIndexSource {
  readonly path: string;
  readonly sha256: string;
  readonly sourceKind: "source" | "test" | "rule" | "config" | "package" | "doc";
  readonly sourceId: string;
}

export interface FileIndexInput {
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly rootPath: string;
  readonly files: readonly FileIndexSource[];
  readonly createdAt: string;
}

export interface FileIndexNode {
  readonly symbolId: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly sourceId: string;
  readonly path: string;
  readonly language: string;
  readonly name: string;
  readonly symbolKind: SymbolKind;
  readonly startLine: number;
  readonly endLine: number;
  readonly bodyHash?: string;
  readonly signatureHash?: string;
  readonly confidence: SymbolConfidence;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface FileIndexEdge {
  readonly edgeId: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly fromSymbolId: string;
  readonly toSymbolId?: string;
  readonly toRef?: string;
  readonly edgeType: SymbolEdgeType;
  readonly confidence: SymbolConfidence;
  readonly discoveryMethod: SymbolDiscoveryMethod;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface FileIndexResult {
  readonly nodes: readonly FileIndexNode[];
  readonly edges: readonly FileIndexEdge[];
  readonly skipped: readonly FileIndexSkip[];
}

export interface FileIndexSkip {
  readonly path: string;
  readonly reason: "unsupported_kind" | "too_large" | "binary" | "unreadable" | "symlink" | "hash_mismatch";
}

const maxIndexedBytes = 512 * 1024;
const sourceLikeKinds = new Set<FileIndexSource["sourceKind"]>(["source", "test", "config", "package", "rule"]);

export function buildFileIndex(input: FileIndexInput): FileIndexResult {
  const files = input.files.filter((file) => sourceLikeKinds.has(file.sourceKind));
  const filePaths = new Set(files.map((file) => file.path));
  const nodes: FileIndexNode[] = [];
  const edges: FileIndexEdge[] = [];
  const skipped: FileIndexSkip[] = [];

  for (const file of files) {
    const content = readIndexableText(input.rootPath, file, skipped);
    if (!content) continue;

    const moduleNode = moduleNodeForFile(input, file);
    nodes.push(moduleNode);
    const symbols = detectSymbols(input, file, content);
    nodes.push(...symbols);
    edges.push(...symbols.map((symbol) => containsEdge(input, moduleNode.symbolId, symbol.symbolId, symbol.name)));
    edges.push(...detectImportEdges(input, file, moduleNode.symbolId, content, filePaths));
  }

  return { nodes, edges, skipped };
}

function moduleNodeForFile(input: FileIndexInput, file: FileIndexSource): FileIndexNode {
  return {
    symbolId: moduleSymbolId(input, file.path),
    projectId: input.projectId,
    repoId: input.repoId,
    snapshotId: input.snapshotId,
    sourceId: file.sourceId,
    path: file.path,
    language: languageForPath(file.path),
    name: file.path,
    symbolKind: "module",
    startLine: 1,
    endLine: 1,
    bodyHash: file.sha256,
    confidence: "high",
    metadata: { sourceKind: file.sourceKind },
    createdAt: input.createdAt
  };
}

function detectSymbols(input: FileIndexInput, file: FileIndexSource, content: string): FileIndexNode[] {
  const lines = content.split(/\r?\n/);
  const symbols: FileIndexNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const symbol = detectSymbolOnLine(line);
    if (!symbol) continue;

    symbols.push({
      symbolId: `symbol:${hashStableParts([
        input.repoId,
        input.snapshotId,
        file.path,
        symbol.kind,
        symbol.name,
        String(index + 1)
      ]).slice(0, 24)}`,
      projectId: input.projectId,
      repoId: input.repoId,
      snapshotId: input.snapshotId,
      sourceId: file.sourceId,
      path: file.path,
      language: languageForPath(file.path),
      name: symbol.name,
      symbolKind: symbol.kind,
      startLine: index + 1,
      endLine: index + 1,
      signatureHash: sha256(Buffer.from(line.trim())),
      confidence: symbol.confidence,
      metadata: { sourceKind: file.sourceKind, extractor: "regex_v1" },
      createdAt: input.createdAt
    });
  }

  return symbols;
}

function detectImportEdges(
  input: FileIndexInput,
  file: FileIndexSource,
  fromSymbolId: string,
  content: string,
  filePaths: ReadonlySet<string>
): FileIndexEdge[] {
  const edges: FileIndexEdge[] = [];

  for (const specifier of importSpecifiers(content)) {
    const targetPath = resolveLocalImport(file.path, specifier, filePaths);
    const toSymbolId = targetPath ? moduleSymbolId(input, targetPath) : undefined;
    const toRef = targetPath ?? specifier;

    edges.push({
      edgeId: `symbol_edge:${hashStableParts([
        input.repoId,
        input.snapshotId,
        fromSymbolId,
        "imports",
        toSymbolId ?? toRef
      ]).slice(0, 24)}`,
      projectId: input.projectId,
      repoId: input.repoId,
      snapshotId: input.snapshotId,
      fromSymbolId,
      toSymbolId,
      toRef,
      edgeType: "imports",
      confidence: targetPath ? "medium" : "low",
      discoveryMethod: "import_resolution",
      metadata: { specifier, targetPath, extractor: "regex_v1" },
      createdAt: input.createdAt
    });
  }

  return edges;
}

function containsEdge(
  input: FileIndexInput,
  fromSymbolId: string,
  toSymbolId: string,
  name: string
): FileIndexEdge {
  return {
    edgeId: `symbol_edge:${hashStableParts([
      input.repoId,
      input.snapshotId,
      fromSymbolId,
      "contains",
      toSymbolId
    ]).slice(0, 24)}`,
    projectId: input.projectId,
    repoId: input.repoId,
    snapshotId: input.snapshotId,
    fromSymbolId,
    toSymbolId,
    edgeType: "contains",
    confidence: "medium",
    discoveryMethod: "inferred",
    metadata: { name },
    createdAt: input.createdAt
  };
}

function readIndexableText(
  rootPath: string,
  file: FileIndexSource,
  skipped: FileIndexSkip[]
): string | undefined {
  try {
    const absolutePath = safeAbsolutePath(rootPath, file.path);
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      skipped.push({ path: file.path, reason: "symlink" });
      return undefined;
    }
    if (stat.size > maxIndexedBytes) {
      skipped.push({ path: file.path, reason: "too_large" });
      return undefined;
    }

    const bytes = readFileSync(absolutePath);
    if (bytes.includes(0)) {
      skipped.push({ path: file.path, reason: "binary" });
      return undefined;
    }
    if (sha256(bytes) !== file.sha256) {
      skipped.push({ path: file.path, reason: "hash_mismatch" });
      return undefined;
    }

    return bytes.toString("utf8");
  } catch {
    skipped.push({ path: file.path, reason: "unreadable" });
    return undefined;
  }
}

function moduleSymbolId(input: FileIndexInput, repoPath: string): string {
  return `symbol:${hashStableParts([input.repoId, input.snapshotId, repoPath, "module"]).slice(0, 24)}`;
}
