export interface SecretFinding {
  readonly kind: string;
  readonly pattern: string;
}

export interface SecretScanResult {
  readonly ok: boolean;
  readonly findings: readonly SecretFinding[];
}

interface SecretPatternEntry {
  readonly kind: string;
  readonly pattern: string;
  readonly regex?: RegExp;
  readonly test?: (text: string) => boolean;
}

const secretPatterns: readonly SecretPatternEntry[] = [
  {
    kind: "private_key_block",
    pattern: "-----BEGIN PRIVATE KEY-----",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/
  },
  {
    kind: "env_secret_assignment",
    pattern: "SECRET|TOKEN|PASSWORD|API_KEY assignment",
    test: hasEnvSecretAssignment
  },
  {
    kind: "secret_named_assignment",
    pattern: "secret-like key assigned to literal value",
    test: hasSecretNamedLiteralAssignment
  },
  {
    kind: "aws_access_key",
    pattern: "AWS access key id",
    regex: /\bAKIA[0-9A-Z]{16}\b/
  },
  {
    kind: "api_secret_token",
    pattern: "common API secret token",
    regex: /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{20,})\b/
  },
  {
    kind: "credentialed_database_url",
    pattern: "database URL with embedded credentials",
    regex: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s/@]+:[^@\s]+@/i
  }
] as const;

export function scanTextForSecrets(text: string): SecretScanResult {
  const findings = secretPatterns.flatMap((entry): SecretFinding[] =>
    patternMatches(entry, text) ? [{ kind: entry.kind, pattern: entry.pattern }] : []
  );
  return { ok: findings.length === 0, findings };
}

function patternMatches(entry: SecretPatternEntry, text: string): boolean {
  if (entry.regex) return entry.regex.test(text);
  return entry.test?.(text) ?? false;
}

function hasEnvSecretAssignment(text: string): boolean {
  for (const line of text.split(/\r?\n/)) {
    const assignmentPattern = /\b(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)\s*=\s*["']?([^"'\s]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = assignmentPattern.exec(line)) !== null) {
      if (!isEnvironmentReference(unquote(match[1]))) return true;
    }
  }
  return false;
}

function hasSecretNamedLiteralAssignment(text: string): boolean {
  for (const line of text.split(/\r?\n/)) {
    const assignmentPattern =
      /["']?([A-Za-z0-9_.-]{1,100})["']?\s*[:=]\s*("[^"\r\n]{8,}"|'[^'\r\n]{8,}'|[A-Za-z0-9_./+=:@-]{8,})/g;
    let match: RegExpExecArray | null;
    while ((match = assignmentPattern.exec(line)) !== null) {
      const key = normalizeSecretKey(match[1]);
      const value = unquote(match[2]);
      if (isSecretKeyName(key) && !isEnvironmentReference(value)) return true;
    }
  }
  return false;
}

function normalizeSecretKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

function isSecretKeyName(key: string): boolean {
  return [
    "secret",
    "token",
    "password",
    "passwd",
    "apikey",
    "privatekey",
    "accesstoken",
    "authtoken",
    "clientsecret",
    "databaseurl",
    "dbpassword",
    "servicerole"
  ].some((suffix) => key === suffix || key.endsWith(suffix));
}

function isEnvironmentReference(value: string): boolean {
  return /^(?:process\.env|import\.meta\.env|env)\b/i.test(value);
}

function unquote(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
