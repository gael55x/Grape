import path from "node:path";
import * as ts from "typescript";

import { tryNormalizeIndexRepoPath } from "./index-paths.js";
import { supportedModuleResolutionExtensions } from "./module-resolution-candidates.js";

export interface TypeScriptModuleResolutionContext {
  readonly rootPath: string;
  readonly filePaths: ReadonlySet<string>;
  readonly fileTextByPath: ReadonlyMap<string, string>;
  readonly compilerConfigs: readonly TypeScriptCompilerConfig[];
}

interface TypeScriptCompilerConfig {
  readonly configPath: string;
  readonly configDir: string;
  readonly options: ts.CompilerOptions;
}

const defaultCompilerOptions: ts.CompilerOptions = {
  allowJs: true,
  checkJs: false,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  resolveJsonModule: true,
  target: ts.ScriptTarget.Latest
};

export function createTypeScriptModuleResolutionContext(input: {
  readonly rootPath: string;
  readonly filePaths: ReadonlySet<string>;
  readonly fileTextByPath: ReadonlyMap<string, string>;
}): TypeScriptModuleResolutionContext {
  return {
    ...input,
    compilerConfigs: parseCompilerConfigs(input.rootPath, input.filePaths, input.fileTextByPath)
  };
}

export function resolveTypeScriptImport(
  fromRepoPath: string,
  specifier: string,
  context: TypeScriptModuleResolutionContext
): string | undefined {
  if (specifier.startsWith("node:")) return undefined;
  const normalizedFromPath = tryNormalizeIndexRepoPath(fromRepoPath);
  if (!normalizedFromPath) return undefined;
  const config = nearestCompilerConfig(normalizedFromPath, context.compilerConfigs);
  const host = compilerResolutionHost(context);
  const containingFile = path.resolve(context.rootPath, normalizedFromPath);
  const resolved = ts.resolveModuleName(specifier, containingFile, config.options, host).resolvedModule;
  const repoPath = resolved?.resolvedFileName
    ? repoPathFromAbsolute(context.rootPath, resolved.resolvedFileName)
    : undefined;
  return repoPath && context.filePaths.has(repoPath) ? repoPath : undefined;
}

function nearestCompilerConfig(
  fromRepoPath: string,
  configs: readonly TypeScriptCompilerConfig[]
): TypeScriptCompilerConfig {
  return [...configs]
    .filter((config) => fromRepoPath === config.configDir || fromRepoPath.startsWith(`${config.configDir}/`))
    .sort((left, right) => right.configDir.length - left.configDir.length)[0] ?? configs[0];
}

function parseCompilerConfigs(
  rootPath: string,
  filePaths: ReadonlySet<string>,
  fileTextByPath: ReadonlyMap<string, string>
): readonly TypeScriptCompilerConfig[] {
  const host = compilerResolutionHost({ rootPath, filePaths, fileTextByPath });
  const configs = [...filePaths]
    .filter((filePath) => path.posix.basename(filePath).toLowerCase() === "tsconfig.json")
    .map((configPath) => parseCompilerConfig(rootPath, configPath, fileTextByPath.get(configPath), host))
    .filter((config): config is TypeScriptCompilerConfig => Boolean(config))
    .sort((left, right) => left.configPath.localeCompare(right.configPath));

  return configs.length > 0
    ? configs
    : [{ configPath: "tsconfig.json", configDir: ".", options: defaultCompilerOptions }];
}

function parseCompilerConfig(
  rootPath: string,
  configPath: string,
  configText: string | undefined,
  host: ts.ParseConfigHost
): TypeScriptCompilerConfig | undefined {
  if (!configText) return undefined;
  const configFileName = path.resolve(rootPath, configPath);
  const parsedJson = ts.parseConfigFileTextToJson(configFileName, configText);
  if (parsedJson.error) return undefined;
  const configDirAbsolute = path.dirname(configFileName);
  const parsed = ts.parseJsonConfigFileContent(
    parsedJson.config,
    host,
    configDirAbsolute,
    defaultCompilerOptions,
    configFileName
  );
  const configDir = path.posix.dirname(configPath) === "" ? "." : path.posix.dirname(configPath);
  return {
    configPath,
    configDir,
    options: {
      ...defaultCompilerOptions,
      ...parsed.options,
      allowJs: true,
      resolveJsonModule: true
    }
  };
}

function compilerResolutionHost(context: {
  readonly rootPath: string;
  readonly filePaths: ReadonlySet<string>;
  readonly fileTextByPath: ReadonlyMap<string, string>;
}): ts.ModuleResolutionHost & ts.ParseConfigHost {
  return {
    useCaseSensitiveFileNames: true,
    getCurrentDirectory: () => path.resolve(context.rootPath),
    fileExists: (fileName) => {
      const repoPath = repoPathFromAbsolute(context.rootPath, fileName);
      return Boolean(repoPath && context.filePaths.has(repoPath));
    },
    readFile: (fileName) => {
      const repoPath = repoPathFromAbsolute(context.rootPath, fileName);
      return repoPath ? context.fileTextByPath.get(repoPath) : undefined;
    },
    directoryExists: (directoryName) => {
      const repoPath = repoPathFromAbsolute(context.rootPath, directoryName);
      if (repoPath === ".") return true;
      return Boolean(repoPath && hasFileUnderDirectory(repoPath, context.filePaths));
    },
    getDirectories: (directoryName) => {
      const repoPath = repoPathFromAbsolute(context.rootPath, directoryName);
      return repoPath ? directoriesUnder(repoPath, context.filePaths) : [];
    },
    realpath: (fileName) => fileName,
    readDirectory: (rootDir, extensions) => {
      const repoRoot = repoPathFromAbsolute(context.rootPath, rootDir);
      if (!repoRoot) return [];
      const allowedExtensions = new Set(extensions ?? supportedModuleResolutionExtensions());
      return [...context.filePaths]
        .filter((filePath) => repoRoot === "." || filePath === repoRoot || filePath.startsWith(`${repoRoot}/`))
        .filter((filePath) => allowedExtensions.size === 0 || allowedExtensions.has(path.posix.extname(filePath)))
        .map((filePath) => path.resolve(context.rootPath, filePath));
    }
  };
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
