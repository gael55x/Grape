import { rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const distPath = path.join(root, "dist");
const relativeDist = path.relative(root, distPath);

if (relativeDist !== "dist") {
  throw new Error(`refusing to clean unexpected dist path: ${distPath}`);
}

rmSync(distPath, { recursive: true, force: true });
