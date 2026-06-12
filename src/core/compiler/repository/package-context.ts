import type { InMemoryContextDependencyShape } from "../../../shared/index.js";
import type { CompileRepositoryContextArtifactInput, RepositoryArtifactSourceInput } from "./types.js";

const packageManifestBasenames = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "settings.gradle",
  "settings.gradle.kts"
]);

const packageContextSourceScopeKey = "packageContextSource";

export interface PackageContextSource {
  readonly source: RepositoryArtifactSourceInput;
  readonly packageRoot: string;
}

export function packageContextSources(
  input: CompileRepositoryContextArtifactInput
): readonly PackageContextSource[] {
  const packageRoots = knownPackageContextRoots(input);
  if (packageRoots.length === 0) return [];

  return input.sources
    .flatMap((source) =>
      packageRoots
        .filter((packageRoot) => isPackageContextSource(source, packageRoot))
        .map((packageRoot) => ({ source, packageRoot }))
    )
    .sort((left, right) => {
      const sourceOrder = left.source.sourceRef.localeCompare(right.source.sourceRef);
      return sourceOrder !== 0 ? sourceOrder : left.packageRoot.localeCompare(right.packageRoot);
    });
}

export function packageContextSourceScope(packageRoot: string): Record<string, unknown> {
  return {
    packageRoot,
    [packageContextSourceScopeKey]: true
  };
}

export function packageContextDependencyRefsForSourceRefs(
  sourceRefs: readonly string[],
  dependencies: readonly InMemoryContextDependencyShape[]
): string[] {
  const packageRoots = new Set(
    sourceRefs
      .map(packageRootForSourceRef)
      .filter((packageRoot): packageRoot is string => Boolean(packageRoot))
  );
  if (packageRoots.size === 0) return [];

  return [
    ...new Set(
      dependencies
        .filter((dependency) => dependency.scope[packageContextSourceScopeKey] === true)
        .filter((dependency) => {
          const packageRoot = dependency.scope.packageRoot;
          return typeof packageRoot === "string" && packageRoots.has(packageRoot);
        })
        .map((dependency) => dependency.id)
    )
  ];
}

function knownPackageContextRoots(input: CompileRepositoryContextArtifactInput): readonly string[] {
  const roots = new Set<string>();
  const scopedPackageRoot = input.currentScope?.packageRoot;
  if (typeof scopedPackageRoot === "string") roots.add(scopedPackageRoot);

  const seedPackageRoot = currentPackageRootFromSourceRefs([
    ...(input.taskRetrieval?.explicitSourceRefs ?? []),
    ...(input.taskRetrieval?.testSourceRefs ?? [])
  ]);
  if (seedPackageRoot) roots.add(seedPackageRoot);

  return [...roots].filter((root) => root !== ".").sort((left, right) => left.localeCompare(right));
}

function currentPackageRootFromSourceRefs(sourceRefs: readonly string[]): string | undefined {
  const roots = [
    ...new Set(
      sourceRefs
        .map(packageRootForSourceRef)
        .filter((root): root is string => Boolean(root))
    )
  ];
  return roots.length === 1 ? roots[0] : undefined;
}

function packageRootForSourceRef(sourceRef: string): string | undefined {
  const normalized = normalizeSourceRef(sourceRef);
  if (!normalized) return undefined;
  const parts = normalized.split("/");
  if (parts.length < 3) return undefined;

  const [workspaceDir, packageName] = parts;
  if (!isWorkspaceRootDir(workspaceDir) || !packageName) return undefined;
  return `${workspaceDir}/${packageName}`;
}

function isPackageContextSource(source: RepositoryArtifactSourceInput, packageRoot: string): boolean {
  const normalized = normalizeSourceRef(source.sourceRef);
  if (!normalized || !normalized.startsWith(`${packageRoot}/`)) return false;
  if (source.privacyStatus !== "allowed" || source.redactionStatus === "blocked") return false;
  if (source.sourceType === "lockfile") return true;
  return source.sourceType === "config_file" && packageManifestBasenames.has(basename(normalized));
}

function normalizeSourceRef(sourceRef: string): string | undefined {
  const normalized = sourceRef.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (
    normalized === "" ||
    normalized === "." ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    /^[A-Za-z]:\//.test(normalized) ||
    /[\0\r\n\t]/.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function basename(sourceRef: string): string {
  const index = sourceRef.lastIndexOf("/");
  return (index === -1 ? sourceRef : sourceRef.slice(index + 1)).toLowerCase();
}

function isWorkspaceRootDir(value: string): boolean {
  return value === "packages" || value === "apps" || value === "services" || value === "libs";
}
