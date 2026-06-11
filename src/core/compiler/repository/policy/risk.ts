import { selectedRuleSourceExcerpts, selectedSourceExcerpts } from "../selection/index.js";
import type {
  CompileRepositoryContextArtifactInput,
  RepositoryArtifactSourceExcerptInput
} from "../types.js";

export interface RepositoryRiskPolicyResult {
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
}

export function evaluateRepositoryRiskPolicy(
  input: CompileRepositoryContextArtifactInput
): RepositoryRiskPolicyResult {
  if (input.riskOverlays.length === 0) {
    return {
      warnings: [],
      unsafeReasons: []
    };
  }

  const exactExcerpts = selectedRiskRelevantExactSourceExcerpts(input);
  return {
    warnings: ["risk_overlay_requires_exact_context"],
    unsafeReasons: exactExcerpts.length === 0 ? ["risk_overlay_missing_exact_context"] : []
  };
}

export function selectedPolicyExactSourceExcerpts(
  input: CompileRepositoryContextArtifactInput
): readonly RepositoryArtifactSourceExcerptInput[] {
  if (input.riskOverlays.length === 0) {
    return selectedSourceExcerpts(input.sourceExcerpts, input.taskRetrieval?.selectedSourceRefs ?? []);
  }

  const taskSelectedRefs = new Set(input.taskRetrieval?.selectedSourceRefs ?? []);
  if (taskSelectedRefs.size === 0) return [];

  const selectedGenericExcerpts = selectedSourceExcerpts(input.sourceExcerpts, [...taskSelectedRefs]).filter(
    (excerpt) => taskSelectedRefs.has(excerpt.sourceRef)
  );
  const selectedRuleExcerpts = selectedRuleSourceExcerpts(input.sourceExcerpts).filter((excerpt) =>
    taskSelectedRefs.has(excerpt.sourceRef)
  );

  return uniqueExcerpts([...selectedGenericExcerpts, ...selectedRuleExcerpts]);
}

function selectedRiskRelevantExactSourceExcerpts(
  input: CompileRepositoryContextArtifactInput
): readonly RepositoryArtifactSourceExcerptInput[] {
  const riskTerms = new Set(input.riskOverlays.flatMap(riskOverlayTerms));
  return selectedPolicyExactSourceExcerpts(input).filter((excerpt) =>
    riskTerms.size === 0 || excerptBodyMatchesRiskTerms(excerpt.excerpt, riskTerms)
  );
}

function riskOverlayTerms(overlay: CompileRepositoryContextArtifactInput["riskOverlays"][number]): readonly string[] {
  switch (overlay) {
    case "auth":
      return [
        "auth", "authenticate", "authentication", "authorize", "authorization",
        "session", "login", "logout", "signin", "signout",
        "token", "jwt", "bearer", "oauth", "cookie",
        "credential", "identity"
      ];
    case "permissions":
      return ["permission", "role", "access", "authorize", "authorization", "policy", "rbac", "acl", "grant", "scope"];
    case "payments":
      return ["payment", "billing", "invoice", "checkout", "stripe", "charge", "refund", "subscription", "price"];
    case "webhooks":
      return ["webhook", "signature", "payload", "event", "hmac", "verify"];
    case "secrets":
      return ["secret", "token", "password", "key", "credential", "apikey", "private", "sensitive"];
    case "crypto":
      return ["crypto", "encrypt", "decrypt", "hash", "signature", "cipher", "digest", "salt", "hmac"];
    case "migration":
      return ["migration", "schema", "sql", "database", "rollback", "migrate", "alter", "column"];
    case "production_config":
      return ["production", "config", "env", "deploy", "release", "environment", "infra", "prod"];
    case "security":
      return [
        "security", "auth", "authenticate", "authentication",
        "permission", "secret", "token", "crypto", "vulnerability",
        "cve", "sanitize", "escape", "injection", "xss", "csrf"
      ];
  }
}

function tokenizeRiskEvidenceText(text: string): readonly string[] {
  const camelSplit = text.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const tokens = camelSplit
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return tokens;
}

function excerptBodyMatchesRiskTerms(text: string, terms: ReadonlySet<string>): boolean {
  const bodyTokens = new Set(tokenizeRiskEvidenceText(text));
  for (const term of terms) {
    for (const token of tokenizeRiskEvidenceText(term)) {
      if (bodyTokens.has(token)) return true;
    }
  }
  return false;
}

function uniqueExcerpts(
  excerpts: readonly RepositoryArtifactSourceExcerptInput[]
): readonly RepositoryArtifactSourceExcerptInput[] {
  const byProofId = new Map<string, RepositoryArtifactSourceExcerptInput>();
  for (const excerpt of excerpts) {
    if (!byProofId.has(excerpt.proofId)) {
      byProofId.set(excerpt.proofId, excerpt);
    }
  }
  return [...byProofId.values()];
}
