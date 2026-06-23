import { hashStableParts } from "./index-hash.js";
import { resolveImport, type ImportResolutionContext, type ImportResolutionMethod } from "./import-resolution.js";
import { languageProviderMetadataFields, type LanguageProviderMetadata } from "./language-provider.js";
import { packageRootMetadataFields, type PackageRootMetadata } from "./package-roots.js";
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
  importResolutionContext: ImportResolutionContext
): FileIndexEdge[] {
  const edges: FileIndexEdge[] = [];
  const symbolLookup = symbolLookupFor(allNodes);

  for (const parsed of parsedFiles) {
    edges.push(...parsed.symbols.map((symbol) =>
      containsEdge(input, parsed.moduleNode.symbolId, symbol, parsed.provider, parsed.packageRoot)
    ));
    edges.push(...parsed.symbols.filter((symbol) => symbol.metadata.exported === true).map((symbol) =>
      exportEdge(input, parsed.moduleNode.symbolId, symbol.symbolId, symbol.name, parsed.provider, parsed.packageRoot)
    ));
    edges.push(...detectImportEdges(input, parsed, importResolutionContext));
    if (parsed.ast) {
      edges.push(...detectReExportEdges(input, parsed, importResolutionContext));
      edges.push(...detectCallEdges(input, parsed, symbolLookup, importResolutionContext));
    }
  }

  return edges;
}

function detectImportEdges(
  input: FileIndexInput,
  parsed: ParsedFileIndex,
  importResolutionContext: ImportResolutionContext
): FileIndexEdge[] {
  const imports = parsed.ast?.imports ?? [];

  return imports.map((candidate) => {
    const resolvedImport = resolveImport(parsed.file.path, candidate.specifier, importResolutionContext);
    const toSymbolId = resolvedImport ? moduleSymbolId(input, resolvedImport.targetPath) : undefined;
    const toRef = resolvedImport?.targetPath ?? candidate.specifier;
    return {
      edgeId: `symbol_edge:${hashStableParts([
        input.repoId,
        input.snapshotId,
        parsed.moduleNode.symbolId,
        "imports",
        toSymbolId ?? toRef,
        bindingSignature(candidate.bindings)
      ]).slice(0, 24)}`,
      projectId: input.projectId,
      repoId: input.repoId,
      snapshotId: input.snapshotId,
      fromSymbolId: parsed.moduleNode.symbolId,
      toSymbolId,
      toRef,
      edgeType: "imports",
      confidence: resolvedImport ? "medium" : "low",
      discoveryMethod: candidate.dynamic ? "ast" : "import_resolution",
      metadata: {
        ...languageProviderMetadataFields(parsed.provider),
        ...packageRootMetadataFields(parsed.packageRoot),
        specifier: candidate.specifier,
        targetPath: resolvedImport?.targetPath,
        resolutionMethod: resolutionMethodForMetadata(resolvedImport?.method),
        bindings: candidate.bindings,
        bindingSignature: bindingSignature(candidate.bindings),
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
  importResolutionContext: ImportResolutionContext
): FileIndexEdge[] {
  return (parsed.ast?.reExports ?? []).map((candidate) => {
    const resolvedImport = resolveImport(parsed.file.path, candidate.specifier, importResolutionContext);
    const toSymbolId = resolvedImport ? moduleSymbolId(input, resolvedImport.targetPath) : undefined;
    const toRef = resolvedImport?.targetPath ?? candidate.specifier;
    return {
      edgeId: `symbol_edge:${hashStableParts([
        input.repoId,
        input.snapshotId,
        parsed.moduleNode.symbolId,
        "exports",
        toSymbolId ?? toRef,
        bindingSignature(candidate.bindings)
      ]).slice(0, 24)}`,
      projectId: input.projectId,
      repoId: input.repoId,
      snapshotId: input.snapshotId,
      fromSymbolId: parsed.moduleNode.symbolId,
      toSymbolId,
      toRef,
      edgeType: "exports",
      confidence: resolvedImport ? "medium" : "low",
      discoveryMethod: "ast",
      metadata: {
        ...languageProviderMetadataFields(parsed.provider),
        ...packageRootMetadataFields(parsed.packageRoot),
        specifier: candidate.specifier,
        targetPath: resolvedImport?.targetPath,
        resolutionMethod: resolutionMethodForMetadata(resolvedImport?.method),
        bindings: candidate.bindings,
        bindingSignature: bindingSignature(candidate.bindings),
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
  importResolutionContext: ImportResolutionContext
): FileIndexEdge[] {
  return (parsed.ast?.calls ?? []).map((call) => {
    const fromSymbol = containingSymbol(parsed, call) ?? parsed.moduleNode;
    const targetSymbol = resolveCallTarget(parsed, call, symbolLookup, importResolutionContext);
    const toRef = targetSymbol ? targetSymbol.name : call.name;
    return {
      edgeId: `symbol_edge:${hashStableParts([
        input.repoId,
        input.snapshotId,
        fromSymbol.symbolId,
        "calls",
        targetSymbol?.symbolId ?? toRef,
        String(call.line),
        String(call.column),
        call.expression
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
        ...packageRootMetadataFields(parsed.packageRoot),
        name: call.name,
        expression: call.expression,
        line: call.line,
        column: call.column,
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
  provider: LanguageProviderMetadata,
  packageRoot?: PackageRootMetadata
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
    metadata: {
      name: symbol.name,
      ...languageProviderMetadataFields(provider),
      ...(packageRoot ? packageRootMetadataFields(packageRoot) : {})
    },
    createdAt: input.createdAt
  };
}

function exportEdge(
  input: FileIndexInput,
  fromSymbolId: string,
  toSymbolId: string,
  name: string,
  provider: LanguageProviderMetadata,
  packageRoot: PackageRootMetadata
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
    metadata: {
      name,
      ...languageProviderMetadataFields(provider),
      ...packageRootMetadataFields(packageRoot),
      extractor: "typescript_ast"
    },
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

function bindingSignature(bindings: readonly { readonly localName: string; readonly importedName: string }[]): string {
  return JSON.stringify(bindings.map((binding) => [binding.localName, binding.importedName]));
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
  importResolutionContext: ImportResolutionContext
): FileIndexNode | undefined {
  const sameFile = symbolLookup.byPathAndName.get(`${parsed.file.path}:${call.name}`);
  if (sameFile) return sameFile;

  for (const candidate of parsed.ast?.imports ?? []) {
    const binding = candidate.bindings.find((entry) => entry.localName === call.name);
    if (!binding) continue;
    const resolvedImport = resolveImport(parsed.file.path, candidate.specifier, importResolutionContext);
    if (!resolvedImport) continue;
    return symbolLookup.byPathAndName.get(`${resolvedImport.targetPath}:${binding.importedName}`) ??
      symbolLookup.byPathAndName.get(`${resolvedImport.targetPath}:${call.name}`);
  }

  const matches = symbolLookup.byName.get(call.name) ?? [];
  return matches.length === 1 ? matches[0] : undefined;
}

function resolutionMethodForMetadata(method: ImportResolutionMethod | undefined): string {
  return method ?? "unresolved";
}
