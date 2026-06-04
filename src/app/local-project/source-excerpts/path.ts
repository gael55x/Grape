import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";

import { maxSnapshotFileBytes } from "../../../core/git/index.js";

export function readAllowedSourceBytes(rootPath: string, sourceRef: string): Buffer | undefined {
  const normalizedRef = normalizeRepoPath(sourceRef);
  if (!normalizedRef) return undefined;
  const absolutePath = path.resolve(rootPath, normalizedRef);
  if (!isInsideRoot(rootPath, absolutePath)) return undefined;

  try {
    const stat = lstatSync(absolutePath);
    if (!stat.isFile() && !stat.isSymbolicLink()) return undefined;
    if (!stat.isSymbolicLink() && stat.size > maxSnapshotFileBytes) return undefined;
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
  if (path.isAbsolute(inputPath) || path.win32.isAbsolute(inputPath)) return undefined;
  const normalized = inputPath.replace(/\\/g, "/");
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
