import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function readPackageVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const packageJsonPath = join(dir, "package.json");
      const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "name" in parsed &&
        "version" in parsed &&
        (parsed as { readonly name?: unknown }).name === "grape-context" &&
        typeof (parsed as { readonly version?: unknown }).version === "string"
      ) {
        return (parsed as { readonly version: string }).version;
      }
    } catch {
      // Walk up toward the package root.
    }
    dir = dirname(dir);
  }

  throw new Error("grape-context package.json not found for PACKAGE_VERSION");
}

export const PACKAGE_VERSION = readPackageVersion();
