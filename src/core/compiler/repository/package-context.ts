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
  return [
    ...new Set(
      dependencies
        .filter((dependency) => dependency.scope[packageContextSourceScopeKey] === true)
        .filter((dependency) => {
          const packageRoot = dependency.scope.packageRoot;
          return (
            typeof packageRoot === "string" &&
            sourceRefs.some((sourceRef) => sourceRefIsInPackageRoot(sourceRef, packageRoot))
          );
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

  for (const packageRoot of indexedPackageRootsForSourceRefs(input, input.taskRetrieval?.selectedSourceRefs ?? [])) {
    roots.add(packageRoot);
  }

  return [...roots].filter((root) => root !== ".").sort((left, right) => left.localeCompare(right));
}

function indexedPackageRootsForSourceRefs(
  input: CompileRepositoryContextArtifactInput,
  sourceRefs: readonly string[]
): readonly string[] {
  const selectedRefs = normalizedSourceRefs(sourceRefs);
  if (selectedRefs.size === 0) return [];

  const roots = new Set<string>();
  for (const node of input.symbolNodes) {
    const normalizedNodePath = normalizeSourceRef(node.path);
    if (!normalizedNodePath || !selectedRefs.has(normalizedNodePath)) continue;
    const metadata = parseObjectJson(node.metadataJson);
    const packageRoot = stringField(metadata, "packageRoot") ?? stringField(metadata, "manifestPackageRoot");
    if (!packageRoot || packageRoot === ".") continue;
    if (![...selectedRefs].some((sourceRef) => sourceRefIsInPackageRoot(sourceRef, packageRoot))) continue;
    roots.add(packageRoot);
  }

  return [...roots].sort((left, right) => left.localeCompare(right));
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

function sourceRefIsInPackageRoot(sourceRef: string, packageRoot: string): boolean {
  const normalizedSourceRef = normalizeSourceRef(sourceRef);
  const normalizedPackageRoot = normalizeSourceRef(packageRoot);
  if (!normalizedSourceRef || !normalizedPackageRoot) return false;
  return normalizedSourceRef === normalizedPackageRoot || normalizedSourceRef.startsWith(`${normalizedPackageRoot}/`);
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

function normalizedSourceRefs(sourceRefs: readonly string[]): Set<string> {
  const normalizedRefs = new Set<string>();
  for (const sourceRef of sourceRefs) {
    const normalized = normalizeSourceRef(sourceRef);
    if (normalized) normalizedRefs.add(normalized);
  }
  return normalizedRefs;
}

function basename(sourceRef: string): string {
  const index = sourceRef.lastIndexOf("/");
  return (index === -1 ? sourceRef : sourceRef.slice(index + 1)).toLowerCase();
}

function isWorkspaceRootDir(value: string): boolean {
  return value === "packages" || value === "apps" || value === "services" || value === "libs";
}

function parseObjectJson(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function stringField(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  if (typeof value !== "string") return undefined;
  return normalizeSourceRef(value);
}
