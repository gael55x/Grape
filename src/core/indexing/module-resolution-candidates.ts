import path from "node:path";

const supportedExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".json"];
const supportedIndexFiles = [
  "index.ts",
  "index.tsx",
  "index.js",
  "index.jsx",
  "index.mjs",
  "index.cjs",
  "index.mts",
  "index.cts"
];

export function resolveCandidatePath(basePath: string, filePaths: ReadonlySet<string>): string | undefined {
  const candidates = [
    basePath,
    ...supportedExtensions.map((extension) => `${basePath}${extension}`),
    ...supportedIndexFiles.map((indexFile) => path.posix.join(basePath, indexFile))
  ];

  return candidates.find((candidate) => filePaths.has(candidate));
}

export function supportedModuleResolutionExtensions(): readonly string[] {
  return supportedExtensions;
}
