import { scanTextForSecrets } from "./secret-scan.js";

export type ArtifactSecretFinding = ReturnType<typeof scanTextForSecrets>["findings"][number];

export interface ArtifactSecretScanResult {
  readonly ok: boolean;
  readonly findings: readonly ArtifactSecretFinding[];
}

export function scanArtifactTextForSecrets(text: string): ArtifactSecretScanResult {
  return scanTextForSecrets(text);
}

export function assertArtifactTextHasNoSecrets(text: string, label: string): void {
  const scan = scanArtifactTextForSecrets(text);
  if (scan.ok) return;

  const kinds = scan.findings.map((finding) => finding.kind).join(", ");
  throw new Error(`artifact secret scan blocked ${label}: ${kinds}`);
}
