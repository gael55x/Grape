const workspaceRootDirs = new Set(["packages", "apps", "services", "libs"]);

export function packageRootForSourceRef(sourceRef: string): string | undefined {
  const normalized = normalizeSourceRef(sourceRef);
  if (!normalized) return undefined;
  const parts = normalized.split("/");
  if (parts.length < 3) return undefined;

  const [workspaceDir, packageName] = parts;
  if (!workspaceRootDirs.has(workspaceDir) || !packageName) return undefined;
  return `${workspaceDir}/${packageName}`;
}

export function packagePrefixForSourceRef(sourceRef: string): string | undefined {
  const packageRoot = packageRootForSourceRef(sourceRef);
  return packageRoot ? `${packageRoot}/` : undefined;
}

export function currentPackageRootFromSourceRefs(sourceRefs: readonly string[]): string | undefined {
  const roots = [
    ...new Set(
      sourceRefs
        .map(packageRootForSourceRef)
        .filter((root): root is string => Boolean(root))
    )
  ];
  return roots.length === 1 ? roots[0] : undefined;
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
