import path from "node:path";

export function normalizeRepoRelativePath(rootPath: string, inputPath: string, label: string): string {
  if (typeof inputPath !== "string" || inputPath.trim() === "") throw new Error(`${label} must be a non-empty path`);
  if (path.win32.isAbsolute(inputPath) && !path.isAbsolute(inputPath)) {
    throw new Error(`${label} must be inside the repository root`);
  }

  const portableInput = inputPath.replace(/\\/g, path.sep);
  const resolved = path.isAbsolute(portableInput)
    ? path.resolve(portableInput)
    : path.resolve(rootPath, portableInput);
  const relative = path.relative(rootPath, resolved);
  if (relative === "") return ".";
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must be inside the repository root`);
  }
  return relative.split(path.sep).join("/");
}
