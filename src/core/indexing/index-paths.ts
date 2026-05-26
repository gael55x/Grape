import path from "node:path";

export function languageForPath(repoPath: string): string {
  const extension = path.posix.extname(repoPath).toLowerCase();
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
    default:
      return "unknown";
  }
}

export function safeAbsolutePath(rootPath: string, repoPath: string): string {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedPath = path.resolve(resolvedRoot, repoPath);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`unsafe indexed path: ${repoPath}`);
  }
  return resolvedPath;
}
