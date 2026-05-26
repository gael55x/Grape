import path from "node:path";

export type SourceKind = "source" | "test" | "rule" | "config" | "package" | "doc";

export function classifySourceKind(repoPath: string): SourceKind {
  const normalized = repoPath.toLowerCase();
  const basename = path.posix.basename(normalized);

  if (basename === "package.json" || basename.endsWith("-lock.json") || basename.endsWith(".lock")) {
    return "package";
  }
  if (isRulePath(normalized, basename)) {
    return "rule";
  }
  if (normalized.includes(".test.") || normalized.includes(".spec.") || normalized.includes("__tests__/")) {
    return "test";
  }
  if (
    basename.startsWith("tsconfig") ||
    basename.includes("config") ||
    normalized.startsWith(".github/") ||
    normalized.startsWith(".vscode/")
  ) {
    return "config";
  }
  if (basename.endsWith(".md") || normalized.startsWith("docs/")) {
    return "doc";
  }
  return "source";
}

function isRulePath(normalizedRepoPath: string, basename: string): boolean {
  return (
    basename === "agents.md" ||
    basename === ".cursorrules" ||
    normalizedRepoPath === ".cursor/rules" ||
    normalizedRepoPath.startsWith(".cursor/rules/") ||
    normalizedRepoPath === ".aiassistant/rules" ||
    normalizedRepoPath.startsWith(".aiassistant/rules/") ||
    normalizedRepoPath === ".junie/guidelines.md" ||
    normalizedRepoPath.startsWith(".grape/")
  );
}
