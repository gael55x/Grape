import path from "node:path";
import * as ts from "typescript";

import type { AstCallCandidate } from "./typescript-ast-index.js";
import type { FileIndexSource } from "./file-index-types.js";
import { languageForPath, tryNormalizeIndexRepoPath } from "./index-paths.js";
import { supportedModuleResolutionExtensions } from "./module-resolution-candidates.js";

export interface TypeScriptTypeAwareCallTarget {
  readonly sourcePath: string;
  readonly line: number;
  readonly column: number;
  readonly expression: string;
  readonly targetPath: string;
  readonly targetName: string;
  readonly targetStartLine: number;
  readonly targetEndLine: number;
}

export function resolveTypeScriptTypeAwareCallTargets(input: {
  readonly rootPath: string;
  readonly files: readonly FileIndexSource[];
  readonly fileTextByPath: ReadonlyMap<string, string>;
}): ReadonlyMap<string, readonly TypeScriptTypeAwareCallTarget[]> {
  const filePaths = new Set(input.files.map((file) => file.path));
  const rootNames = [...filePaths]
    .filter(isTypeScriptLikePath)
    .map((filePath) => path.resolve(input.rootPath, filePath));
  if (rootNames.length === 0) return new Map();

  const options = compilerOptions(input.rootPath, filePaths, input.fileTextByPath);
  const host = compilerHost(input.rootPath, filePaths, input.fileTextByPath, options);
  let program: ts.Program;
  try {
    program = ts.createProgram({ rootNames, options, host });
  } catch {
    return new Map();
  }

  const checker = program.getTypeChecker();
  const targetsByPath = new Map<string, TypeScriptTypeAwareCallTarget[]>();
  for (const sourceFile of program.getSourceFiles()) {
    const sourcePath = repoPathFromAbsolute(input.rootPath, sourceFile.fileName);
    if (!sourcePath || !filePaths.has(sourcePath) || !isTypeScriptLikePath(sourcePath)) continue;
    const targets: TypeScriptTypeAwareCallTarget[] = [];
    collectCallTargets(sourceFile, sourcePath, input.rootPath, filePaths, checker, targets);
    if (targets.length > 0) targetsByPath.set(sourcePath, targets);
  }
  return targetsByPath;
}

export function typeAwareTargetForCall(
  targets: readonly TypeScriptTypeAwareCallTarget[] | undefined,
  call: AstCallCandidate
): TypeScriptTypeAwareCallTarget | undefined {
  return targets?.find((target) =>
    target.line === call.line &&
    target.column === call.column &&
    target.expression === call.expression
  );
}

function collectCallTargets(
  sourceFile: ts.SourceFile,
  sourcePath: string,
  rootPath: string,
  filePaths: ReadonlySet<string>,
  checker: ts.TypeChecker,
  targets: TypeScriptTypeAwareCallTarget[]
): void {
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const target = callTarget(sourceFile, sourcePath, rootPath, filePaths, checker, node);
      if (target) targets.push(target);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function callTarget(
  sourceFile: ts.SourceFile,
  sourcePath: string,
  rootPath: string,
  filePaths: ReadonlySet<string>,
  checker: ts.TypeChecker,
  node: ts.CallExpression
): TypeScriptTypeAwareCallTarget | undefined {
  const symbol = checker.getSymbolAtLocation(node.expression) ??
    (ts.isPropertyAccessExpression(node.expression)
      ? checker.getSymbolAtLocation(node.expression.name)
      : undefined);
  if (!symbol) return undefined;

  const targetSymbol = resolveAlias(symbol, checker);
  const declaration = firstAllowedDeclaration(targetSymbol, rootPath, filePaths);
  if (!declaration) return undefined;
  const targetPath = repoPathFromAbsolute(rootPath, declaration.getSourceFile().fileName);
  if (!targetPath || !filePaths.has(targetPath)) return undefined;

  const targetName = declarationName(declaration) ?? usefulSymbolName(targetSymbol);
  if (!targetName) return undefined;

  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const targetRange = declarationLineRange(declaration);
  return {
    sourcePath,
    line: start.line + 1,
    column: start.character + 1,
    expression: node.expression.getText(sourceFile),
    targetPath,
    targetName,
    targetStartLine: targetRange.startLine,
    targetEndLine: targetRange.endLine
  };
}

function resolveAlias(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  if ((symbol.flags & ts.SymbolFlags.Alias) === 0) return symbol;
  try {
    return checker.getAliasedSymbol(symbol);
  } catch {
    return symbol;
  }
}

function firstAllowedDeclaration(
  symbol: ts.Symbol,
  rootPath: string,
  filePaths: ReadonlySet<string>
): ts.Declaration | undefined {
  return symbol.declarations?.find((declaration) => {
    const sourcePath = repoPathFromAbsolute(rootPath, declaration.getSourceFile().fileName);
    return Boolean(sourcePath && filePaths.has(sourcePath));
  });
}

function declarationName(declaration: ts.Declaration): string | undefined {
  const name = (declaration as ts.NamedDeclaration).name;
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isPrivateIdentifier(name)) return name.text;
  return undefined;
}

function usefulSymbolName(symbol: ts.Symbol): string | undefined {
  const name = symbol.getName();
  return name && name !== "__function" ? name : undefined;
}

function declarationLineRange(declaration: ts.Declaration): { startLine: number; endLine: number } {
  const sourceFile = declaration.getSourceFile();
  const start = sourceFile.getLineAndCharacterOfPosition(declaration.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(declaration.getEnd());
  return {
    startLine: start.line + 1,
    endLine: end.line + 1
  };
}

function isTypeScriptLikePath(repoPath: string): boolean {
  const language = languageForPath(repoPath);
  return language === "typescript" ||
    language === "typescript_tsx" ||
    language === "javascript" ||
    language === "javascript_jsx";
}

function compilerOptions(
  rootPath: string,
  filePaths: ReadonlySet<string>,
  fileTextByPath: ReadonlyMap<string, string>
): ts.CompilerOptions {
  const configPath = rootCompilerConfigPath(filePaths);
  if (!configPath) return defaultCompilerOptions;
  const configText = fileTextByPath.get(configPath);
  if (!configText) return defaultCompilerOptions;

  const host = parseConfigHost(rootPath, filePaths, fileTextByPath);
  const configFileName = path.resolve(rootPath, configPath);
  const parsedJson = ts.parseConfigFileTextToJson(configFileName, configText);
  if (parsedJson.error) return defaultCompilerOptions;

  const parsed = ts.parseJsonConfigFileContent(
    parsedJson.config,
    host,
    path.dirname(configFileName),
    defaultCompilerOptions,
    configFileName
  );
  return {
    ...defaultCompilerOptions,
    ...parsed.options,
    allowJs: true,
    checkJs: false,
    noLib: true,
    resolveJsonModule: true,
    skipLibCheck: true
  };
}

const defaultCompilerOptions: ts.CompilerOptions = {
  allowJs: true,
  checkJs: false,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  noLib: true,
  resolveJsonModule: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.Latest
};

function rootCompilerConfigPath(filePaths: ReadonlySet<string>): string | undefined {
  return [...filePaths]
    .filter((filePath) => path.posix.basename(filePath).toLowerCase() === "tsconfig.json")
    .sort((left, right) => pathDepth(left) - pathDepth(right) || left.localeCompare(right))[0];
}

function pathDepth(repoPath: string): number {
  return repoPath.split("/").length;
}

function compilerHost(
  rootPath: string,
  filePaths: ReadonlySet<string>,
  fileTextByPath: ReadonlyMap<string, string>,
  options: ts.CompilerOptions
): ts.CompilerHost {
  const host: ts.CompilerHost = {
    fileExists: (fileName) => {
      const repoPath = repoPathFromAbsolute(rootPath, fileName);
      return Boolean(repoPath && filePaths.has(repoPath));
    },
    readFile: (fileName) => {
      const repoPath = repoPathFromAbsolute(rootPath, fileName);
      return repoPath ? fileTextByPath.get(repoPath) : undefined;
    },
    getSourceFile: (fileName, languageVersionOrOptions) => {
      const repoPath = repoPathFromAbsolute(rootPath, fileName);
      const text = repoPath ? fileTextByPath.get(repoPath) : undefined;
      if (!repoPath || text === undefined) return undefined;
      return ts.createSourceFile(fileName, text, languageVersionOrOptions, true, scriptKindForPath(repoPath));
    },
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: () => undefined,
    getCurrentDirectory: () => path.resolve(rootPath),
    getDirectories: (directoryName) => {
      const repoPath = repoPathFromAbsolute(rootPath, directoryName);
      return repoPath ? directoriesUnder(repoPath, filePaths) : [];
    },
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    directoryExists: (directoryName) => {
      const repoPath = repoPathFromAbsolute(rootPath, directoryName);
      if (repoPath === ".") return true;
      return Boolean(repoPath && hasFileUnderDirectory(repoPath, filePaths));
    },
    realpath: (fileName) => fileName,
    readDirectory: (rootDir, extensions) => readDirectory(rootPath, filePaths, rootDir, extensions),
    resolveModuleNames: (moduleNames, containingFile) =>
      moduleNames.map((moduleName) =>
        ts.resolveModuleName(moduleName, containingFile, options, host).resolvedModule
      )
  };
  return host;
}

function parseConfigHost(
  rootPath: string,
  filePaths: ReadonlySet<string>,
  fileTextByPath: ReadonlyMap<string, string>
): ts.ParseConfigHost {
  return {
    useCaseSensitiveFileNames: true,
    fileExists: (fileName) => {
      const repoPath = repoPathFromAbsolute(rootPath, fileName);
      return Boolean(repoPath && filePaths.has(repoPath));
    },
    readFile: (fileName) => {
      const repoPath = repoPathFromAbsolute(rootPath, fileName);
      return repoPath ? fileTextByPath.get(repoPath) : undefined;
    },
    readDirectory: (rootDir, extensions) => readDirectory(rootPath, filePaths, rootDir, extensions)
  };
}

function readDirectory(
  rootPath: string,
  filePaths: ReadonlySet<string>,
  rootDir: string,
  extensions: readonly string[] | undefined
): string[] {
  const repoRoot = repoPathFromAbsolute(rootPath, rootDir);
  if (!repoRoot) return [];
  const allowedExtensions = new Set(extensions ?? supportedModuleResolutionExtensions());
  return [...filePaths]
    .filter((filePath) => repoRoot === "." || filePath === repoRoot || filePath.startsWith(`${repoRoot}/`))
    .filter((filePath) => allowedExtensions.size === 0 || allowedExtensions.has(path.posix.extname(filePath)))
    .map((filePath) => path.resolve(rootPath, filePath));
}

function repoPathFromAbsolute(rootPath: string, absolutePath: string): string | undefined {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedPath = path.resolve(absolutePath);
  if (resolvedPath === resolvedRoot) return ".";
  if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) return undefined;
  const relativePath = path.relative(resolvedRoot, resolvedPath).replace(/\\/g, "/");
  return tryNormalizeIndexRepoPath(relativePath);
}

function hasFileUnderDirectory(directoryPath: string, filePaths: ReadonlySet<string>): boolean {
  const prefix = directoryPath === "." ? "" : `${directoryPath}/`;
  for (const filePath of filePaths) {
    if (directoryPath === "." || filePath.startsWith(prefix)) return true;
  }
  return false;
}

function directoriesUnder(directoryPath: string, filePaths: ReadonlySet<string>): string[] {
  const prefix = directoryPath === "." ? "" : `${directoryPath}/`;
  const dirs = new Set<string>();
  for (const filePath of filePaths) {
    if (directoryPath !== "." && !filePath.startsWith(prefix)) continue;
    const rest = directoryPath === "." ? filePath : filePath.slice(prefix.length);
    const [first] = rest.split("/");
    if (first && first !== rest) dirs.add(first);
  }
  return [...dirs].sort();
}

function scriptKindForPath(repoPath: string): ts.ScriptKind {
  if (repoPath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (repoPath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (repoPath.endsWith(".js") || repoPath.endsWith(".mjs") || repoPath.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}
