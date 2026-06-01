import type { RiskOverlay } from "../../../shared/index.js";

const riskMatchers: readonly { readonly overlay: RiskOverlay; readonly patterns: readonly RegExp[] }[] = [
  { overlay: "security", patterns: [/\bsecurity\b/, /\bvulnerab/, /\bcve\b/] },
  { overlay: "auth", patterns: [/\bauth\b/, /\bauthentication\b/, /\bauthorization\b/, /\blogin\b/, /\bsession\b/] },
  { overlay: "permissions", patterns: [/\bpermission/, /\brbac\b/, /\brole\b/, /\baccess control\b/] },
  { overlay: "payments", patterns: [/\bpayment/, /\bbilling\b/, /\bstripe\b/, /\bcheckout\b/] },
  { overlay: "webhooks", patterns: [/\bwebhook/] },
  { overlay: "secrets", patterns: [/\bsecret/, /\btoken\b/, /\bapi key\b/, /\bprivate key\b/, /\b\.env\b/] },
  { overlay: "crypto", patterns: [/\bcrypto/, /\bencrypt/, /\bdecrypt/, /\bsignature\b/] },
  { overlay: "migration", patterns: [/\bmigration\b/, /\bschema\b/, /\bdatabase\b/] },
  { overlay: "production_config", patterns: [/\bproduction\b/, /\bprod config\b/, /\bdeploy/, /\binfra\b/] }
];

export function detectRiskOverlaysForTask(task: string, seedRefs: readonly string[] = []): RiskOverlay[] {
  const text = [task, ...seedRefs].join("\n").toLowerCase();
  const overlays: RiskOverlay[] = [];
  for (const matcher of riskMatchers) {
    if (matcher.patterns.some((pattern) => pattern.test(text))) overlays.push(matcher.overlay);
  }
  return overlays;
}

export function mergeRiskOverlays(
  explicitOverlays: readonly RiskOverlay[],
  detectedOverlays: readonly RiskOverlay[]
): RiskOverlay[] {
  return [...new Set([...explicitOverlays, ...detectedOverlays])];
}
