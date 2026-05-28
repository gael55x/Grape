import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";

export function readAllowedSourceBytes(rootPath: string, sourceRef: string): Buffer | undefined {
  const normalizedRef = normalizeRepoPath(sourceRef);
  if (!normalizedRef) return undefined;
  const absolutePath = path.resolve(rootPath, normalizedRef);
  if (!isInsideRoot(rootPath, absolutePath)) return undefined;

  try {
    const stat = lstatSync(absolutePath);
    if (!stat.isFile() && !stat.isSymbolicLink()) return undefined;
    return stat.isSymbolicLink()
      ? Buffer.from(`symlink:${readlinkSync(absolutePath)}`)
      : readFileSync(absolutePath);
  } catch {
    return undefined;
  }
}

function isInsideRoot(rootPath: string, absolutePath: string): boolean {
  const relativePath = path.relative(rootPath, absolutePath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function normalizeRepoPath(inputPath: string): string | undefined {
  const normalized = inputPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    normalized === "" ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    return undefined;
  }
  return normalized;
}
