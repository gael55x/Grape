import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "src/core/storage/migrations");
const targetDir = path.join(root, "dist/core/storage/migrations");

mkdirSync(targetDir, { recursive: true });

for (const file of readdirSync(sourceDir).filter((entry) => entry.endsWith(".sql")).sort()) {
  copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
}
