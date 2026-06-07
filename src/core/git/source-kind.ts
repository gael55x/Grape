import path from "node:path";

export type SourceKind = "source" | "test" | "rule" | "config" | "package" | "doc";

export type PackageManifestKind =
  | "npm_package"
  | "python_pyproject"
  | "python_requirements"
  | "rust_cargo"
  | "go_module"
  | "maven_pom"
  | "gradle_build"
  | "gradle_settings";

export function classifySourceKind(repoPath: string): SourceKind {
  const normalized = repoPath.toLowerCase();
  const basename = path.posix.basename(normalized);

  if (packageManifestKindForPath(normalized) || isPackageLockfile(basename)) {
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

export function packageManifestKindForPath(repoPath: string): PackageManifestKind | undefined {
  const normalized = repoPath.toLowerCase().replace(/\\/g, "/");
  const basename = path.posix.basename(normalized);

  if (basename === "package.json") return "npm_package";
  if (basename === "pyproject.toml") return "python_pyproject";
  if (basename === "requirements.txt") return "python_requirements";
  if (basename === "cargo.toml") return "rust_cargo";
  if (basename === "go.mod") return "go_module";
  if (basename === "pom.xml") return "maven_pom";
  if (basename === "build.gradle" || basename === "build.gradle.kts") return "gradle_build";
  if (basename === "settings.gradle" || basename === "settings.gradle.kts") return "gradle_settings";
  return undefined;
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

function isPackageLockfile(basename: string): boolean {
  return basename.endsWith("-lock.json") || basename.endsWith(".lock");
}
