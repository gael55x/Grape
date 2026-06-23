import path from "node:path";

import { tryNormalizeIndexRepoPath } from "./index-paths.js";
import { resolveCandidatePath } from "./module-resolution-candidates.js";
import {
  createTypeScriptModuleResolutionContext,
  resolveTypeScriptImport,
  type TypeScriptModuleResolutionContext
} from "./typescript-module-resolution.js";
import {
  createWorkspacePackageResolutionContext,
  resolveWorkspacePackageImport,
  type WorkspacePackageResolutionContext
} from "./workspace-package-resolution.js";
import type { FileIndexSource } from "./file-index-types.js";

export type ImportResolutionMethod =
  | "relative_path"
  | "typescript_compiler"
  | "workspace_package_exports";

export interface ImportResolutionResult {
  readonly targetPath: string;
  readonly method: ImportResolutionMethod;
}

export interface ImportResolutionContext {
  readonly filePaths: ReadonlySet<string>;
  readonly typeScript: TypeScriptModuleResolutionContext;
  readonly workspacePackages: WorkspacePackageResolutionContext;
}

export function createImportResolutionContext(input: {
  readonly rootPath: string;
  readonly files: readonly FileIndexSource[];
  readonly fileTextByPath: ReadonlyMap<string, string>;
}): ImportResolutionContext {
  const filePaths = new Set(input.files.map((file) => file.path));
  return {
    filePaths,
    typeScript: createTypeScriptModuleResolutionContext({
      rootPath: input.rootPath,
      filePaths,
      fileTextByPath: input.fileTextByPath
    }),
    workspacePackages: createWorkspacePackageResolutionContext({
      filePaths,
      fileTextByPath: input.fileTextByPath
    })
  };
}

export function resolveImport(
  fromRepoPath: string,
  specifier: string,
  context: ImportResolutionContext
): ImportResolutionResult | undefined {
  const relativePath = resolveLocalImport(fromRepoPath, specifier, context.filePaths);
  if (relativePath) return { targetPath: relativePath, method: "relative_path" };

  const compilerPath = resolveTypeScriptImport(fromRepoPath, specifier, context.typeScript);
  if (compilerPath) return { targetPath: compilerPath, method: "typescript_compiler" };

  const workspacePath = resolveWorkspacePackageImport(specifier, context.workspacePackages);
  if (workspacePath) return { targetPath: workspacePath, method: "workspace_package_exports" };

  return undefined;
}

export function resolveLocalImport(
  fromRepoPath: string,
  specifier: string,
  filePaths: ReadonlySet<string>
): string | undefined {
  if (!specifier.startsWith(".")) return undefined;

  const normalizedFromPath = tryNormalizeIndexRepoPath(fromRepoPath);
  if (!normalizedFromPath) return undefined;

  const baseDir = path.posix.dirname(normalizedFromPath);
  const basePath = safeNormalizeImportPath(path.posix.join(baseDir, specifier));
  if (!basePath) return undefined;

  return resolveCandidatePath(basePath, filePaths);
}

function safeNormalizeImportPath(inputPath: string): string | undefined {
  return tryNormalizeIndexRepoPath(inputPath);
}
