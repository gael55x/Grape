import { selectedSourceExcerpts } from "../selection/index.js";
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

  return selectedSourceExcerpts(input.sourceExcerpts, [...taskSelectedRefs]).filter((excerpt) =>
    taskSelectedRefs.has(excerpt.sourceRef)
  );
}

function selectedRiskRelevantExactSourceExcerpts(
  input: CompileRepositoryContextArtifactInput
): readonly RepositoryArtifactSourceExcerptInput[] {
  const riskTerms = new Set(input.riskOverlays.flatMap(riskOverlayTerms));
  return selectedPolicyExactSourceExcerpts(input).filter((excerpt) =>
    riskTerms.size === 0 ||
    textMatchesRiskTerms(excerpt.sourceRef, riskTerms) ||
    textMatchesRiskTerms(excerpt.excerpt, riskTerms)
  );
}

function riskOverlayTerms(overlay: CompileRepositoryContextArtifactInput["riskOverlays"][number]): readonly string[] {
  switch (overlay) {
    case "auth":
      return ["auth", "session", "login", "token", "credential"];
    case "permissions":
      return ["permission", "role", "access", "authorize", "policy"];
    case "payments":
      return ["payment", "billing", "invoice", "checkout", "stripe"];
    case "webhooks":
      return ["webhook", "signature", "payload", "event"];
    case "secrets":
      return ["secret", "token", "password", "key", "credential"];
    case "crypto":
      return ["crypto", "encrypt", "decrypt", "hash", "signature"];
    case "migration":
      return ["migration", "schema", "sql", "database", "rollback"];
    case "production_config":
      return ["production", "config", "env", "deploy", "release"];
    case "security":
      return ["security", "auth", "permission", "secret", "token", "crypto"];
  }
}

function textMatchesRiskTerms(text: string, terms: ReadonlySet<string>): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  for (const term of terms) {
    if (normalized.includes(term)) return true;
  }
  return false;
}
