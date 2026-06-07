import path from "node:path";

export function languageForPath(repoPath: string): string {
  const normalized = normalizeIndexRepoPath(repoPath);
  const basename = path.posix.basename(normalized).toLowerCase();
  const extension = path.posix.extname(normalized).toLowerCase();
  if (basename === "go.mod") return "go";
  if (basename === "requirements.txt") return "python_requirements";
  if (basename === "build.gradle") return "gradle";
  if (basename === "settings.gradle") return "gradle";
  switch (extension) {
    case ".ts":
      return "typescript";
    case ".tsx":
      return "typescript_tsx";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".jsx":
      return "javascript_jsx";
    case ".json":
      return "json";
    case ".md":
      return "markdown";
    case ".py":
      return "python";
    case ".java":
      return "java";
    case ".kt":
    case ".kts":
      return "kotlin";
    case ".go":
      return "go";
    case ".rs":
      return "rust";
    case ".yml":
    case ".yaml":
      return "yaml";
    case ".toml":
      return "toml";
    case ".xml":
      return "xml";
    case ".gradle":
      return "gradle";
    default:
      return "unknown";
  }
}

export function safeAbsolutePath(rootPath: string, repoPath: string): string {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedPath = path.resolve(resolvedRoot, normalizeIndexRepoPath(repoPath));
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`unsafe indexed path: ${repoPath}`);
  }
  return resolvedPath;
}

export function normalizeIndexRepoPath(inputPath: string): string {
  const normalized = inputPath.replace(/\\/g, "/");
  if (
    normalized === "" ||
    normalized === "." ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new Error(`unsafe indexed path: ${inputPath}`);
  }
  return normalized;
}

export function tryNormalizeIndexRepoPath(inputPath: string): string | undefined {
  try {
    return normalizeIndexRepoPath(inputPath);
  } catch {
    return undefined;
  }
}
