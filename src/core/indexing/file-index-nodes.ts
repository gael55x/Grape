import type { SymbolKind } from "../storage/index.js";
import { hashStableParts, sha256 } from "./index-hash.js";
import { languageForPath } from "./index-paths.js";
import { detectSymbolOnLine } from "./symbol-detection.js";
import type { AstSymbolCandidate } from "./typescript-ast-index.js";
import type { FileIndexInput, FileIndexNode, FileIndexSource } from "./file-index-types.js";

export function moduleNodeForFile(
  input: FileIndexInput,
  file: FileIndexSource,
  extractor: "typescript_ast" | "regex_basic"
): FileIndexNode {
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
    metadata: { sourceKind: file.sourceKind, extractor },
    createdAt: input.createdAt
  };
}

export function detectRegexSymbols(input: FileIndexInput, file: FileIndexSource, content: string): FileIndexNode[] {
  const lines = content.split(/\r?\n/);
  const symbols: FileIndexNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const symbol = detectSymbolOnLine(line);
    if (!symbol) continue;

    symbols.push({
      symbolId: symbolIdFor(input, file.path, symbol.kind, symbol.name, index + 1),
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
      metadata: { sourceKind: file.sourceKind, extractor: "regex_basic", exported: false },
      createdAt: input.createdAt
    });
  }

  return symbols;
}

export function symbolNodeForAstSymbol(
  input: FileIndexInput,
  file: FileIndexSource,
  symbol: AstSymbolCandidate
): FileIndexNode {
  return {
    symbolId: symbolIdFor(input, file.path, symbol.kind, symbol.name, symbol.startLine),
    projectId: input.projectId,
    repoId: input.repoId,
    snapshotId: input.snapshotId,
    sourceId: file.sourceId,
    path: file.path,
    language: languageForPath(file.path),
    name: symbol.name,
    symbolKind: symbol.kind,
    startLine: symbol.startLine,
    endLine: symbol.endLine,
    bodyHash: symbol.bodyHash,
    signatureHash: symbol.signatureHash,
    confidence: symbol.confidence,
    metadata: { sourceKind: file.sourceKind, ...symbol.metadata },
    createdAt: input.createdAt
  };
}

export function moduleSymbolId(input: FileIndexInput, repoPath: string): string {
  return `symbol:${hashStableParts([input.repoId, input.snapshotId, repoPath, "module"]).slice(0, 24)}`;
}

function symbolIdFor(
  input: FileIndexInput,
  repoPath: string,
  kind: SymbolKind,
  name: string,
  startLine: number
): string {
  return `symbol:${hashStableParts([
    input.repoId,
    input.snapshotId,
    repoPath,
    kind,
    name,
    String(startLine)
  ]).slice(0, 24)}`;
}
