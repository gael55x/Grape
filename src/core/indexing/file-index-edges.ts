import { hashStableParts } from "./index-hash.js";
import { importSpecifiers, resolveLocalImport } from "./import-resolution.js";
import { languageProviderMetadataFields, type LanguageProviderMetadata } from "./language-provider.js";
import type { AstCallCandidate } from "./typescript-ast-index.js";
import type { FileIndexEdge, FileIndexInput, FileIndexNode, ParsedFileIndex } from "./file-index-types.js";
import { moduleSymbolId } from "./file-index-nodes.js";

interface SymbolLookup {
  readonly byPathAndName: ReadonlyMap<string, FileIndexNode>;
  readonly byName: ReadonlyMap<string, readonly FileIndexNode[]>;
}

export function fileIndexEdgesForParsedFiles(
  input: FileIndexInput,
  parsedFiles: readonly ParsedFileIndex[],
  allNodes: readonly FileIndexNode[],
  filePaths: ReadonlySet<string>
): FileIndexEdge[] {
  const edges: FileIndexEdge[] = [];
  const symbolLookup = symbolLookupFor(allNodes);

  for (const parsed of parsedFiles) {
    edges.push(...parsed.symbols.map((symbol) =>
      containsEdge(input, parsed.moduleNode.symbolId, symbol, parsed.provider)
    ));
    edges.push(...parsed.symbols.filter((symbol) => symbol.metadata.exported === true).map((symbol) =>
      exportEdge(input, parsed.moduleNode.symbolId, symbol.symbolId, symbol.name, parsed.provider)
    ));
    edges.push(...detectImportEdges(input, parsed, filePaths));
    if (parsed.ast) {
      edges.push(...detectReExportEdges(input, parsed, filePaths));
      edges.push(...detectCallEdges(input, parsed, symbolLookup, filePaths));
    }
  }

  return edges;
}

function detectImportEdges(
  input: FileIndexInput,
  parsed: ParsedFileIndex,
  filePaths: ReadonlySet<string>
): FileIndexEdge[] {
  const imports = parsed.ast?.imports ?? importSpecifiers(parsed.text).map((specifier) => ({
    specifier,
    bindings: [],
    dynamic: false
  }));

  return imports.map((candidate) => {
    const targetPath = resolveLocalImport(parsed.file.path, candidate.specifier, filePaths);
    const toSymbolId = targetPath ? moduleSymbolId(input, targetPath) : undefined;
    const toRef = targetPath ?? candidate.specifier;
    return {
      edgeId: `symbol_edge:${hashStableParts([
        input.repoId,
        input.snapshotId,
        parsed.moduleNode.symbolId,
        "imports",
        toSymbolId ?? toRef
      ]).slice(0, 24)}`,
      projectId: input.projectId,
      repoId: input.repoId,
      snapshotId: input.snapshotId,
      fromSymbolId: parsed.moduleNode.symbolId,
      toSymbolId,
      toRef,
      edgeType: "imports",
      confidence: targetPath ? "medium" : "low",
      discoveryMethod: candidate.dynamic ? "ast" : "import_resolution",
      metadata: {
        ...languageProviderMetadataFields(parsed.provider),
        specifier: candidate.specifier,
        targetPath,
        bindings: candidate.bindings,
        dynamic: candidate.dynamic,
        extractor: parsed.ast ? "typescript_ast" : "regex_basic"
      },
      createdAt: input.createdAt
    };
  });
}

function detectReExportEdges(
  input: FileIndexInput,
  parsed: ParsedFileIndex,
  filePaths: ReadonlySet<string>
): FileIndexEdge[] {
  return (parsed.ast?.reExports ?? []).map((candidate) => {
    const targetPath = resolveLocalImport(parsed.file.path, candidate.specifier, filePaths);
    const toSymbolId = targetPath ? moduleSymbolId(input, targetPath) : undefined;
    const toRef = targetPath ?? candidate.specifier;
    return {
      edgeId: `symbol_edge:${hashStableParts([
        input.repoId,
        input.snapshotId,
        parsed.moduleNode.symbolId,
        "exports",
        toSymbolId ?? toRef
      ]).slice(0, 24)}`,
      projectId: input.projectId,
      repoId: input.repoId,
      snapshotId: input.snapshotId,
      fromSymbolId: parsed.moduleNode.symbolId,
      toSymbolId,
      toRef,
      edgeType: "exports",
      confidence: targetPath ? "medium" : "low",
      discoveryMethod: "ast",
      metadata: {
        ...languageProviderMetadataFields(parsed.provider),
        specifier: candidate.specifier,
        targetPath,
        bindings: candidate.bindings,
        extractor: "typescript_ast"
      },
      createdAt: input.createdAt
    };
  });
}

function detectCallEdges(
  input: FileIndexInput,
  parsed: ParsedFileIndex,
  symbolLookup: SymbolLookup,
  filePaths: ReadonlySet<string>
): FileIndexEdge[] {
  return (parsed.ast?.calls ?? []).map((call) => {
    const fromSymbol = containingSymbol(parsed, call) ?? parsed.moduleNode;
    const targetSymbol = resolveCallTarget(parsed, call, symbolLookup, filePaths);
    const toRef = targetSymbol ? targetSymbol.name : call.name;
    return {
      edgeId: `symbol_edge:${hashStableParts([
        input.repoId,
        input.snapshotId,
        fromSymbol.symbolId,
        "calls",
        targetSymbol?.symbolId ?? toRef,
        String(call.line)
      ]).slice(0, 24)}`,
      projectId: input.projectId,
      repoId: input.repoId,
      snapshotId: input.snapshotId,
      fromSymbolId: fromSymbol.symbolId,
      toSymbolId: targetSymbol?.symbolId,
      toRef,
      edgeType: "calls",
      confidence: targetSymbol ? "medium" : "low",
      discoveryMethod: "ast",
      metadata: {
        ...languageProviderMetadataFields(parsed.provider),
        name: call.name,
        expression: call.expression,
        line: call.line,
        extractor: "typescript_ast"
      },
      createdAt: input.createdAt
    };
  });
}

function containsEdge(
  input: FileIndexInput,
  fromSymbolId: string,
  symbol: FileIndexNode,
  provider: LanguageProviderMetadata
): FileIndexEdge {
  return {
    edgeId: `symbol_edge:${hashStableParts([
      input.repoId,
      input.snapshotId,
      fromSymbolId,
      "contains",
      symbol.symbolId
    ]).slice(0, 24)}`,
    projectId: input.projectId,
    repoId: input.repoId,
    snapshotId: input.snapshotId,
    fromSymbolId,
    toSymbolId: symbol.symbolId,
    edgeType: "contains",
    confidence: "medium",
    discoveryMethod: "inferred",
    metadata: { name: symbol.name, ...languageProviderMetadataFields(provider) },
    createdAt: input.createdAt
  };
}

function exportEdge(
  input: FileIndexInput,
  fromSymbolId: string,
  toSymbolId: string,
  name: string,
  provider: LanguageProviderMetadata
): FileIndexEdge {
  return {
    edgeId: `symbol_edge:${hashStableParts([
      input.repoId,
      input.snapshotId,
      fromSymbolId,
      "exports",
      toSymbolId
    ]).slice(0, 24)}`,
    projectId: input.projectId,
    repoId: input.repoId,
    snapshotId: input.snapshotId,
    fromSymbolId,
    toSymbolId,
    edgeType: "exports",
    confidence: "high",
    discoveryMethod: "ast",
    metadata: { name, ...languageProviderMetadataFields(provider), extractor: "typescript_ast" },
    createdAt: input.createdAt
  };
}

function symbolLookupFor(nodes: readonly FileIndexNode[]): SymbolLookup {
  const byPathAndName = new Map<string, FileIndexNode>();
  const byName = new Map<string, FileIndexNode[]>();
  for (const node of nodes) {
    byPathAndName.set(`${node.path}:${node.name}`, node);
    byName.set(node.name, [...(byName.get(node.name) ?? []), node]);
  }
  return { byPathAndName, byName };
}

function containingSymbol(parsed: ParsedFileIndex, call: AstCallCandidate): FileIndexNode | undefined {
  return [...parsed.symbols]
    .filter((symbol) => symbol.startLine <= call.line && call.line <= symbol.endLine)
    .sort((left, right) => (left.endLine - left.startLine) - (right.endLine - right.startLine))[0];
}

function resolveCallTarget(
  parsed: ParsedFileIndex,
  call: AstCallCandidate,
  symbolLookup: SymbolLookup,
  filePaths: ReadonlySet<string>
): FileIndexNode | undefined {
  const sameFile = symbolLookup.byPathAndName.get(`${parsed.file.path}:${call.name}`);
  if (sameFile) return sameFile;

  for (const candidate of parsed.ast?.imports ?? []) {
    const binding = candidate.bindings.find((entry) => entry.localName === call.name);
    if (!binding) continue;
    const targetPath = resolveLocalImport(parsed.file.path, candidate.specifier, filePaths);
    if (!targetPath) continue;
    return symbolLookup.byPathAndName.get(`${targetPath}:${binding.importedName}`) ??
      symbolLookup.byPathAndName.get(`${targetPath}:${call.name}`);
  }

  const matches = symbolLookup.byName.get(call.name) ?? [];
  return matches.length === 1 ? matches[0] : undefined;
}
