import { appendFileSync, existsSync, readFileSync } from "node:fs";

import { resolveGitMetadataPath } from "../../core/git/index.js";
import type { InitializeLocalProjectResult } from "./types.js";

export function ensureGrapeExcludedFromGit(
  rootPath: string,
  gitBinary = "git"
): InitializeLocalProjectResult["excludeStatus"] {
  const excludePath = resolveGitMetadataPath(rootPath, "info/exclude", gitBinary);
  const existing = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";
  if (existing.split(/\r?\n/).some((line) => line.trim() === ".grape/")) {
    return "unchanged";
  }

  appendFileSync(excludePath, `${existing.endsWith("\n") || existing.length === 0 ? "" : "\n"}.grape/\n`);
  return "updated";
}

export function gitExcludeContainsGrape(rootPath: string): boolean | undefined {
  try {
    const excludePath = resolveGitMetadataPath(rootPath, "info/exclude");
    return existsSync(excludePath) && readFileSync(excludePath, "utf8").includes(".grape/");
  } catch {
    return undefined;
  }
}
