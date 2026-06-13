const workspaceRootDirs = new Set(["packages", "apps", "services", "libs"]);
const manifestProviderId = "generic_manifest";
const packageRootProviderCapability = "package_roots";

export function packageRootForSourceRef(sourceRef: string): string | undefined {
  const normalized = normalizeSourceRef(sourceRef);
  if (!normalized) return undefined;
  const parts = normalized.split("/");
  if (parts.length < 3) return undefined;

  const [workspaceDir, packageName] = parts;
  if (!workspaceRootDirs.has(workspaceDir) || !packageName) return undefined;
  return `${workspaceDir}/${packageName}`;
}

export function packageRootFromSourceMetadata(sourceRef: string, metadataJson: string | undefined): string | undefined {
  const normalizedSourceRef = normalizeSourceRef(sourceRef);
  if (!normalizedSourceRef) return undefined;
  const metadata = parseMetadata(metadataJson);
  if (!isPackageRootProviderMetadata(metadata)) return undefined;

  const packageRoot = normalizedPackageRoot(
    stringMetadata(metadata, "packageRoot") ?? stringMetadata(metadata, "manifestPackageRoot")
  );
  if (!packageRoot) return undefined;
  return sourceRefIsInPackageRoot(normalizedSourceRef, packageRoot) ? packageRoot : undefined;
}

export function packageRootForSourceRefWithMetadata(
  sourceRef: string,
  metadataJson: string | undefined
): string | undefined {
  return packageRootForSourceRef(sourceRef) ?? packageRootFromSourceMetadata(sourceRef, metadataJson);
}

export function currentPackageRootFromSourceRefs(
  sourceRefs: readonly string[],
  packageRootBySourceRef: ReadonlyMap<string, string> = new Map()
): string | undefined {
  const roots = [
    ...new Set(
      sourceRefs
        .map((sourceRef) => packageRootForCurrentSourceRef(sourceRef, packageRootBySourceRef))
        .filter((root): root is string => Boolean(root))
    )
  ];
  return roots.length === 1 ? roots[0] : undefined;
}

export function packageRootsBySourceRefFromMetadata(
  sources: readonly { readonly sourceRef: string; readonly metadataJson: string | undefined }[]
): ReadonlyMap<string, string> {
  const roots = new Map<string, string>();
  for (const source of sources) {
    const sourceRef = normalizeSourceRef(source.sourceRef);
    if (!sourceRef || roots.has(sourceRef)) continue;
    const packageRoot = packageRootFromSourceMetadata(sourceRef, source.metadataJson);
    if (packageRoot) roots.set(sourceRef, packageRoot);
  }
  return roots;
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

function packageRootForCurrentSourceRef(
  sourceRef: string,
  packageRootBySourceRef: ReadonlyMap<string, string>
): string | undefined {
  const normalized = normalizeSourceRef(sourceRef);
  if (!normalized) return undefined;
  return packageRootForSourceRef(normalized) ?? packageRootBySourceRef.get(normalized);
}

function normalizedPackageRoot(value: string | undefined): string | undefined {
  const normalized = value ? normalizeSourceRef(value) : undefined;
  if (!normalized || normalized === ".") return undefined;
  return normalized;
}

function sourceRefIsInPackageRoot(sourceRef: string, packageRoot: string): boolean {
  return sourceRef === packageRoot || sourceRef.startsWith(`${packageRoot}/`);
}

function isPackageRootProviderMetadata(metadata: Record<string, unknown>): boolean {
  return (
    metadata.packageRootProviderId === manifestProviderId &&
    Array.isArray(metadata.packageRootProviderCapabilities) &&
    metadata.packageRootProviderCapabilities.includes(packageRootProviderCapability)
  );
}

function stringMetadata(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function parseMetadata(metadataJson: string | undefined): Record<string, unknown> {
  if (!metadataJson) return {};
  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}
