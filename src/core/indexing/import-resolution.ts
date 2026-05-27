import path from "node:path";

import { tryNormalizeIndexRepoPath } from "./index-paths.js";

const importPatterns = [
  /\bimport\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+[^'"]+\s+from\s+["']([^"']+)["']/g,
  /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g
];

export function importSpecifiers(content: string): string[] {
  const specifiers = new Set<string>();

  for (const pattern of importPatterns) {
    for (const match of content.matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }

  return [...specifiers].sort();
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
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    path.posix.join(basePath, "index.ts"),
    path.posix.join(basePath, "index.tsx"),
    path.posix.join(basePath, "index.js"),
    path.posix.join(basePath, "index.jsx")
  ];

  return candidates.find((candidate) => filePaths.has(candidate));
}

function safeNormalizeImportPath(inputPath: string): string | undefined {
  return tryNormalizeIndexRepoPath(inputPath);
}
