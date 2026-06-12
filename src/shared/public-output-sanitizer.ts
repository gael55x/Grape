import path from "node:path";

export interface PublicOutputSanitizerOptions {
  readonly rootPath?: string;
  readonly rootLabel?: string;
}

const defaultRootLabel = "<repo-root>";
const genericLocalPathLabel = "<local-path>";
const redactedSecretLabel = "<redacted-secret>";

const commonSecretTokenPattern =
  /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{20,})\b/g;
const credentialedUrlPattern = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s/@]+:[^@\s]+@/gi;
const secretAssignmentPattern =
  /\b([A-Z0-9_]*(?:SECRET|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*[:=]\s*)(["']?)([^"',\s;}]+)(\2)/gi;
const windowsAbsolutePathPattern = /\b[A-Za-z]:[\\/][^\s"'`<>),\]}]*/g;
const posixLocalPathPattern = /(^|[\s"'`(:=])\/(?:Users|home|tmp|private|var|Volumes|mnt|workspace|repo|opt)(?:\/[^\s"'`<>),\]}]*)*/g;

export function sanitizePublicOutput<T>(value: T, options: PublicOutputSanitizerOptions = {}): T {
  return sanitizeValue(value, options, undefined) as T;
}

export function sanitizePublicText(text: string, options: PublicOutputSanitizerOptions = {}): string {
  return sanitizeString(text, options, undefined);
}

function sanitizeValue(
  value: unknown,
  options: PublicOutputSanitizerOptions,
  key: string | undefined
): unknown {
  if (typeof value === "string") return sanitizeString(value, options, key);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, options, undefined));
  if (!isPlainRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeValue(entryValue, options, entryKey)
    ])
  );
}

function sanitizeString(
  value: string,
  options: PublicOutputSanitizerOptions,
  key: string | undefined
): string {
  if (value.length === 0) return value;
  if (key && isSensitiveValueKey(key) && !isPublicOperationalTokenKey(key)) return redactedSecretLabel;

  let sanitized = replaceKnownRootPath(value, options);
  sanitized = sanitized
    .replace(secretAssignmentPattern, `$1$2${redactedSecretLabel}$4`)
    .replace(commonSecretTokenPattern, redactedSecretLabel)
    .replace(credentialedUrlPattern, `<redacted-secret-url>@`)
    .replace(windowsAbsolutePathPattern, genericLocalPathLabel)
    .replace(posixLocalPathPattern, (_match, prefix: string) => `${prefix}${genericLocalPathLabel}`);

  return sanitized;
}

function replaceKnownRootPath(value: string, options: PublicOutputSanitizerOptions): string {
  const rootPath = options.rootPath ?? process.cwd();
  const rootLabel = options.rootLabel ?? defaultRootLabel;
  const resolvedRoot = isWindowsAbsolutePath(rootPath) ? rootPath : path.resolve(rootPath);
  const candidates = rootPathCandidates(resolvedRoot).sort((left, right) => right.length - left.length);

  return candidates.reduce((current, candidate) => {
    return replaceKnownRootCandidate(current, candidate, rootLabel);
  }, value);
}

function rootPathCandidates(resolvedRoot: string): string[] {
  const slashPath = resolvedRoot.replace(/\\/g, "/");
  const backslashPath = resolvedRoot.replace(/\//g, "\\");
  const aliases = [resolvedRoot, slashPath, backslashPath];
  if (slashPath.startsWith("/var/")) aliases.push(`/private${slashPath}`);
  if (slashPath.startsWith("/private/var/")) aliases.push(slashPath.slice("/private".length));

  return uniqueStrings([
    ...aliases,
    ...aliases.map((candidate) => candidate.split("/").join("\\"))
  ]);
}

function replaceKnownRootCandidate(value: string, candidate: string, rootLabel: string): string {
  if (!candidate) return value;
  if (isWindowsAbsolutePath(candidate)) {
    return value.replace(new RegExp(escapeRegExp(candidate), "gi"), rootLabel);
  }
  return value.split(candidate).join(rootLabel);
}

function isWindowsAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function isSensitiveValueKey(key: string): boolean {
  const normalized = key.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  return [
    "apikey",
    "authorization",
    "bearer",
    "clientsecret",
    "credential",
    "password",
    "privatekey",
    "secret"
  ].some((sensitive) => normalized === sensitive || normalized.endsWith(sensitive));
}

function isPublicOperationalTokenKey(key: string): boolean {
  const normalized = key.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  return [
    "restoreid",
    "restoretoken",
    "tokencount",
    "tokenbudget",
    "tokencost",
    "tokenmetric",
    "tokens"
  ].includes(normalized);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
