import path from "node:path";

import { tryNormalizeIndexRepoPath } from "./index-paths.js";
import { resolveCandidatePath } from "./module-resolution-candidates.js";

export interface WorkspacePackageResolutionContext {
  readonly filePaths: ReadonlySet<string>;
  readonly packages: readonly WorkspacePackageExport[];
}

interface WorkspacePackageExport {
  readonly packageName: string;
  readonly packageRoot: string;
  readonly exportsValue?: unknown;
  readonly mainValue?: unknown;
  readonly moduleValue?: unknown;
  readonly typesValue?: unknown;
  readonly typingsValue?: unknown;
}

export function createWorkspacePackageResolutionContext(input: {
  readonly filePaths: ReadonlySet<string>;
  readonly fileTextByPath: ReadonlyMap<string, string>;
}): WorkspacePackageResolutionContext {
  return {
    filePaths: input.filePaths,
    packages: parseWorkspacePackages(input.fileTextByPath)
  };
}

export function resolveWorkspacePackageImport(
  specifier: string,
  context: WorkspacePackageResolutionContext
): string | undefined {
  for (const workspacePackage of context.packages) {
    const subpath = packageSubpath(specifier, workspacePackage.packageName);
    if (subpath === undefined) continue;
    for (const target of workspacePackageTargets(workspacePackage, subpath)) {
      const basePath = tryNormalizeIndexRepoPath(
        workspacePackage.packageRoot === "." ? target : path.posix.join(workspacePackage.packageRoot, target)
      );
      if (!basePath) continue;
      const resolved = resolveCandidatePath(basePath, context.filePaths);
      if (resolved) return resolved;
    }
  }
  return undefined;
}

function parseWorkspacePackages(fileTextByPath: ReadonlyMap<string, string>): readonly WorkspacePackageExport[] {
  return [...fileTextByPath.entries()]
    .filter(([repoPath]) => path.posix.basename(repoPath).toLowerCase() === "package.json")
    .map(([repoPath, text]) => workspacePackageForManifest(repoPath, text))
    .filter((workspacePackage): workspacePackage is WorkspacePackageExport => Boolean(workspacePackage))
    .sort((left, right) => right.packageName.length - left.packageName.length);
}

function workspacePackageForManifest(repoPath: string, text: string): WorkspacePackageExport | undefined {
  const json = parseJsonObject(text);
  const packageName = stringField(json, "name");
  if (!packageName) return undefined;
  const packageRoot = path.posix.dirname(repoPath) === "" ? "." : path.posix.dirname(repoPath);
  return {
    packageName,
    packageRoot,
    exportsValue: json.exports,
    mainValue: json.main,
    moduleValue: json.module,
    typesValue: json.types,
    typingsValue: json.typings
  };
}

function packageSubpath(specifier: string, packageName: string): string | undefined {
  if (specifier === packageName) return ".";
  if (specifier.startsWith(`${packageName}/`)) return `./${specifier.slice(packageName.length + 1)}`;
  return undefined;
}

function workspacePackageTargets(
  workspacePackage: WorkspacePackageExport,
  subpath: string
): readonly string[] {
  const exportTargets = targetsFromExports(workspacePackage.exportsValue, subpath);
  if (exportTargets.length > 0) return exportTargets;

  if (subpath !== ".") return [subpath.replace(/^\.\//, "")];

  return [
    workspacePackage.typesValue,
    workspacePackage.typingsValue,
    workspacePackage.moduleValue,
    workspacePackage.mainValue,
    "./src/index.ts",
    "./src/index.tsx",
    "./src/index.js",
    "./index.ts",
    "./index.tsx",
    "./index.js"
  ].filter((target): target is string => typeof target === "string");
}

function targetsFromExports(exportsValue: unknown, subpath: string): readonly string[] {
  if (!exportsValue) return [];
  if (typeof exportsValue === "string") return subpath === "." ? [exportsValue] : [];
  if (Array.isArray(exportsValue)) return exportsValue.flatMap((value) => targetsFromExports(value, subpath));
  if (!isRecord(exportsValue)) return [];

  const hasExportMap = Object.keys(exportsValue).some((key) => key === "." || key.startsWith("./"));
  if (!hasExportMap) return conditionalTargets(exportsValue);

  const exact = exportsValue[subpath];
  if (exact !== undefined) return conditionalTargets(exact);

  for (const [key, value] of Object.entries(exportsValue)) {
    if (!key.includes("*")) continue;
    const target = targetFromPattern(key, value, subpath);
    if (target) return [target];
  }
  return [];
}

function targetFromPattern(pattern: string, value: unknown, subpath: string): string | undefined {
  const [prefix, suffix] = pattern.split("*", 2);
  if (!prefix || suffix === undefined) return undefined;
  if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) return undefined;
  const replacement = subpath.slice(prefix.length, subpath.length - suffix.length);
  const [targetPattern] = conditionalTargets(value);
  return targetPattern?.replace("*", replacement);
}

function conditionalTargets(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(conditionalTargets);
  if (!isRecord(value)) return [];
  for (const key of ["types", "import", "require", "node", "default"]) {
    const targets = conditionalTargets(value[key]);
    if (targets.length > 0) return targets;
  }
  return [];
}

function parseJsonObject(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
