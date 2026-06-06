import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const buildPath = path.join(root, ".tmp", "build");
const relativeBuild = path.relative(root, buildPath);

if (relativeBuild !== path.join(".tmp", "build")) {
  throw new Error("refusing to clean unexpected test build path");
}

const buildSourceRoot = path.join(buildPath, "src");
if (!existsSync(buildSourceRoot)) {
  process.exit(0);
}

for (const filePath of listFiles(buildSourceRoot)) {
  if (!filePath.endsWith(".js")) continue;
  const relativeSource = path.relative(buildSourceRoot, filePath).replace(/\.js$/, ".ts");
  const expectedSourcePath = path.join(root, "src", relativeSource);
  if (!existsSync(expectedSourcePath)) {
    rmSync(filePath, { force: true });
  }
}

function listFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(entryPath);
    if (entry.isFile()) return [entryPath];
    if (entry.isSymbolicLink()) return [];
    return statSync(entryPath).isFile() ? [entryPath] : [];
  });
}
