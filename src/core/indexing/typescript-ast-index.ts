import * as ts from "typescript";

import type {
  SymbolConfidence,
  SymbolKind
} from "../storage/index.js";
import { sha256 } from "./index-hash.js";
import { languageForPath } from "./index-paths.js";

export interface AstSymbolCandidate {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly startLine: number;
  readonly endLine: number;
  readonly bodyHash?: string;
  readonly signatureHash?: string;
  readonly confidence: SymbolConfidence;
  readonly exported: boolean;
  readonly metadata: Record<string, unknown>;
}

export interface AstImportCandidate {
  readonly specifier: string;
  readonly bindings: readonly AstImportBinding[];
  readonly dynamic: boolean;
}

export interface AstImportBinding {
  readonly localName: string;
  readonly importedName: string;
}

export interface AstCallCandidate {
  readonly name: string;
  readonly expression: string;
  readonly line: number;
}

export interface TypeScriptAstIndexResult {
  readonly symbols: readonly AstSymbolCandidate[];
  readonly imports: readonly AstImportCandidate[];
  readonly reExports: readonly AstImportCandidate[];
  readonly calls: readonly AstCallCandidate[];
}

const supportedLanguages = new Set(["typescript", "typescript_tsx", "javascript", "javascript_jsx"]);

export function parseTypeScriptAstIndex(repoPath: string, content: string): TypeScriptAstIndexResult | undefined {
  if (!supportedLanguages.has(languageForPath(repoPath))) return undefined;

  const sourceFile = ts.createSourceFile(
    repoPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(repoPath)
  );
  const symbols: AstSymbolCandidate[] = [];
  const imports: AstImportCandidate[] = [];
  const reExports: AstImportCandidate[] = [];
  const calls: AstCallCandidate[] = [];

  function visit(node: ts.Node): void {
    const symbol = symbolCandidate(sourceFile, node);
    if (symbol) symbols.push(symbol);

    const importCandidate = importCandidateFromNode(node);
    if (importCandidate) imports.push(importCandidate);

    const reExport = reExportCandidateFromNode(node);
    if (reExport) reExports.push(reExport);

    const call = callCandidate(sourceFile, node);
    if (call) calls.push(call);

    if (ts.isCallExpression(node)) {
      const dynamicImport = dynamicImportCandidateFromCall(node);
      if (dynamicImport) imports.push(dynamicImport);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { symbols, imports, reExports, calls };
}

function scriptKindForPath(repoPath: string): ts.ScriptKind {
  if (repoPath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (repoPath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (repoPath.endsWith(".js") || repoPath.endsWith(".mjs") || repoPath.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function symbolCandidate(sourceFile: ts.SourceFile, node: ts.Node): AstSymbolCandidate | undefined {
  if (ts.isFunctionDeclaration(node) && node.name && isTopLevel(node)) {
    return declarationSymbol(sourceFile, node, node.name.text, "function", hasExportModifier(node), {
      astNode: "FunctionDeclaration"
    });
  }

  if (ts.isClassDeclaration(node) && node.name && isTopLevel(node)) {
    return declarationSymbol(sourceFile, node, node.name.text, "class", hasExportModifier(node), {
      astNode: "ClassDeclaration"
    });
  }

  if (ts.isMethodDeclaration(node) && node.name && isClassMember(node)) {
    return declarationSymbol(sourceFile, node, propertyNameText(node.name), "method", hasExportModifier(node), {
      astNode: "MethodDeclaration"
    });
  }

  if (ts.isInterfaceDeclaration(node) && isTopLevel(node)) {
    return declarationSymbol(sourceFile, node, node.name.text, "interface", hasExportModifier(node), {
      astNode: "InterfaceDeclaration"
    });
  }

  if (ts.isTypeAliasDeclaration(node) && isTopLevel(node)) {
    return declarationSymbol(sourceFile, node, node.name.text, "type", hasExportModifier(node), {
      astNode: "TypeAliasDeclaration"
    });
  }

  if (ts.isVariableDeclaration(node) && isTopLevelVariable(node) && ts.isIdentifier(node.name)) {
    const statement = variableStatementForDeclaration(node);
    const exported = statement ? hasExportModifier(statement) : false;
    return declarationSymbol(
      sourceFile,
      node,
      node.name.text,
      variableSymbolKind(node),
      exported,
      { astNode: "VariableDeclaration" }
    );
  }

  return undefined;
}

function declarationSymbol(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  name: string,
  kind: SymbolKind,
  exported: boolean,
  metadata: Record<string, unknown>
): AstSymbolCandidate | undefined {
  if (!name) return undefined;
  const { startLine, endLine } = lineRange(sourceFile, node);
  const text = node.getText(sourceFile);
  const signature = text.split(/\r?\n/, 1)[0]?.trim() ?? name;
  return {
    name,
    kind,
    startLine,
    endLine,
    bodyHash: sha256(Buffer.from(text)),
    signatureHash: sha256(Buffer.from(signature)),
    confidence: "high",
    exported,
    metadata: {
      ...metadata,
      extractor: "typescript_ast",
      exported
    }
  };
}

function importCandidateFromNode(node: ts.Node): AstImportCandidate | undefined {
  if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return undefined;
  return {
    specifier: node.moduleSpecifier.text,
    bindings: importBindings(node.importClause),
    dynamic: false
  };
}

function reExportCandidateFromNode(node: ts.Node): AstImportCandidate | undefined {
  if (!ts.isExportDeclaration(node) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
    return undefined;
  }
  return {
    specifier: node.moduleSpecifier.text,
    bindings: exportBindings(node.exportClause),
    dynamic: false
  };
}

function dynamicImportCandidateFromCall(node: ts.CallExpression): AstImportCandidate | undefined {
  const [firstArg] = node.arguments;
  if (!firstArg || !ts.isStringLiteralLike(firstArg)) return undefined;
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    return { specifier: firstArg.text, bindings: [], dynamic: true };
  }
  if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
    return { specifier: firstArg.text, bindings: [], dynamic: true };
  }
  return undefined;
}

function callCandidate(sourceFile: ts.SourceFile, node: ts.Node): AstCallCandidate | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  const name = callName(node.expression);
  if (!name) return undefined;
  const { startLine } = lineRange(sourceFile, node);
  return {
    name,
    expression: node.expression.getText(sourceFile),
    line: startLine
  };
}

function callName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function importBindings(importClause: ts.ImportClause | undefined): AstImportBinding[] {
  if (!importClause) return [];
  const bindings: AstImportBinding[] = [];
  if (importClause.name) bindings.push({ localName: importClause.name.text, importedName: "default" });

  const namedBindings = importClause.namedBindings;
  if (!namedBindings) return bindings;
  if (ts.isNamespaceImport(namedBindings)) {
    bindings.push({ localName: namedBindings.name.text, importedName: "*" });
    return bindings;
  }

  for (const element of namedBindings.elements) {
    bindings.push({
      localName: element.name.text,
      importedName: element.propertyName?.text ?? element.name.text
    });
  }
  return bindings;
}

function exportBindings(exportClause: ts.NamedExportBindings | undefined): AstImportBinding[] {
  if (!exportClause) return [];
  if (ts.isNamespaceExport(exportClause)) {
    return [{ localName: exportClause.name.text, importedName: "*" }];
  }
  return exportClause.elements.map((element) => ({
    localName: element.name.text,
    importedName: element.propertyName?.text ?? element.name.text
  }));
}

function variableSymbolKind(node: ts.VariableDeclaration): SymbolKind {
  if (node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
    return "function";
  }
  const declarationList = node.parent;
  if (ts.isVariableDeclarationList(declarationList) && (declarationList.flags & ts.NodeFlags.Const) !== 0) {
    return "constant";
  }
  return "variable";
}

function propertyNameText(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return name.getText();
}

function lineRange(sourceFile: ts.SourceFile, node: ts.Node): { startLine: number; endLine: number } {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return {
    startLine: start.line + 1,
    endLine: end.line + 1
  };
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false);
}

function isTopLevel(node: ts.Node): boolean {
  return ts.isSourceFile(node.parent);
}

function isClassMember(node: ts.Node): boolean {
  return ts.isClassLike(node.parent);
}

function isTopLevelVariable(node: ts.VariableDeclaration): boolean {
  return Boolean(variableStatementForDeclaration(node));
}

function variableStatementForDeclaration(node: ts.VariableDeclaration): ts.VariableStatement | undefined {
  const declarationList = node.parent;
  if (!ts.isVariableDeclarationList(declarationList)) return undefined;
  const statement = declarationList.parent;
  return ts.isVariableStatement(statement) && ts.isSourceFile(statement.parent) ? statement : undefined;
}
