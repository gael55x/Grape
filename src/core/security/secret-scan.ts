export interface SecretFinding {
  readonly kind: string;
  readonly pattern: string;
}

export interface SecretScanResult {
  readonly ok: boolean;
  readonly findings: readonly SecretFinding[];
}

const secretPatterns = [
  {
    kind: "private_key_block",
    pattern: "-----BEGIN PRIVATE KEY-----",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/
  },
  {
    kind: "env_secret_assignment",
    pattern: "SECRET|TOKEN|PASSWORD|API_KEY assignment",
    regex: /\b(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)\s*=\s*["']?[^"'\s]+/i
  },
  {
    kind: "aws_access_key",
    pattern: "AWS access key id",
    regex: /\bAKIA[0-9A-Z]{16}\b/
  }
] as const;

export function scanTextForSecrets(text: string): SecretScanResult {
  const findings = secretPatterns.flatMap((entry): SecretFinding[] =>
    entry.regex.test(text) ? [{ kind: entry.kind, pattern: entry.pattern }] : []
  );
  return { ok: findings.length === 0, findings };
}
