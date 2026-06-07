import type {
  SymbolConfidence,
  SymbolDiscoveryMethod,
  SymbolEdgeType,
  SymbolKind
} from "../storage/index.js";
import type { LanguageProviderMetadata } from "./language-provider.js";
import type { PackageRootMetadata } from "./package-roots.js";
import type { TypeScriptAstIndexResult } from "./typescript-ast-index.js";

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

export interface ParsedFileIndex {
  readonly file: FileIndexSource;
  readonly moduleNode: FileIndexNode;
  readonly symbols: readonly FileIndexNode[];
  readonly provider: LanguageProviderMetadata;
  readonly packageRoot: PackageRootMetadata;
  readonly ast?: TypeScriptAstIndexResult;
  readonly text: string;
}
