import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface PrivacyIgnorePattern {
  readonly sourceFile: string;
  readonly pattern: string;
  readonly lineNumber: number;
  readonly matcher: RegExp;
  readonly basenameOnly: boolean;
}

export interface PrivacyIgnorePolicy {
  readonly rootPath: string;
  readonly patterns: readonly PrivacyIgnorePattern[];
}

const privacyIgnoreFiles = [".ignore", ".cursorignore", ".aiignore", ".grapeignore"] as const;

export function loadPrivacyIgnorePolicy(rootPath: string): PrivacyIgnorePolicy {
  const normalizedRoot = path.resolve(rootPath);
  const patterns: PrivacyIgnorePattern[] = [];

  for (const sourceFile of privacyIgnoreFiles) {
    const absolutePath = path.join(normalizedRoot, sourceFile);
    if (!existsSync(absolutePath)) continue;

    const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const parsed = parseIgnoreLine(lines[index]);
      if (!parsed) continue;
      patterns.push({
        sourceFile,
        pattern: parsed.pattern,
        lineNumber: index + 1,
        matcher: ignorePatternRegex(parsed.pattern),
        basenameOnly: !parsed.pattern.includes("/")
      });
    }
  }

  return { rootPath: normalizedRoot, patterns };
}

export function isIgnoredByPrivacyPolicy(
  repoPath: string,
  policy: PrivacyIgnorePolicy
): boolean {
  const normalizedPath = normalizeRepoPath(repoPath);
  const parts = normalizedPath.split("/");

  return policy.patterns.some((pattern) => {
    if (pattern.basenameOnly) {
      return parts.some((part) => pattern.matcher.test(part));
    }
    return pattern.matcher.test(normalizedPath);
  });
}

function parseIgnoreLine(line: string): { pattern: string } | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return undefined;

  // Ignore patterns are handled conservatively. Negated unignore rules are not
  // supported yet because a false include is riskier than an extra skipped file.
  if (trimmed.startsWith("!")) return undefined;

  return { pattern: normalizeRepoPath(trimmed.replace(/^\/+/, "")) };
}

function ignorePatternRegex(pattern: string): RegExp {
  const directoryPrefix = pattern.endsWith("/");
  const normalized = directoryPrefix ? pattern.slice(0, -1) : pattern;
  const source = ignorePatternSource(normalized);

  if (directoryPrefix) {
    return new RegExp(`^${source}(?:/.*)?$`);
  }
  return new RegExp(`^${source}$`);
}

function ignorePatternSource(pattern: string): string {
  let source = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*" && pattern[index + 1] === "*") {
      source += ".*";
      index += 1;
      continue;
    }
    if (char === "*") {
      source += "[^/]*";
      continue;
    }
    source += escapeRegex(char);
  }

  return source;
}

function normalizeRepoPath(inputPath: string): string {
  return inputPath.replace(/\\/g, "/").replace(/^\/+/, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}
