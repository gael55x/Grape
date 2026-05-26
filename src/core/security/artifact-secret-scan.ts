export interface ArtifactSecretFinding {
  readonly kind: string;
  readonly pattern: string;
}

export interface ArtifactSecretScanResult {
  readonly ok: boolean;
  readonly findings: readonly ArtifactSecretFinding[];
}

const artifactSecretPatterns = [
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

export function scanArtifactTextForSecrets(text: string): ArtifactSecretScanResult {
  const findings = artifactSecretPatterns.flatMap((entry): ArtifactSecretFinding[] =>
    entry.regex.test(text) ? [{ kind: entry.kind, pattern: entry.pattern }] : []
  );
  return { ok: findings.length === 0, findings };
}

export function assertArtifactTextHasNoSecrets(text: string, label: string): void {
  const scan = scanArtifactTextForSecrets(text);
  if (scan.ok) return;

  const kinds = scan.findings.map((finding) => finding.kind).join(", ");
  throw new Error(`artifact secret scan blocked ${label}: ${kinds}`);
}
