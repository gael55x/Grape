export const FORBIDDEN_TRUST_WORDING_PATTERNS: readonly {
  readonly id: string;
  readonly pattern: RegExp;
}[] = [
  { id: "this_is_correct", pattern: /\bthis is correct\b/i },
  { id: "definitely_caused", pattern: /\bdefinitely caused\b/i },
  { id: "this_definitely", pattern: /\bthis definitely\b/i },
  { id: "code_is_wrong", pattern: /\bthis code is wrong\b/i },
  { id: "fix_is_proven", pattern: /\bthis fix is proven\b/i },
  { id: "guaranteed_root_cause", pattern: /\bguaranteed root cause\b/i },
  { id: "proven_fix", pattern: /\bproven fix\b/i },
  { id: "root_cause_confirmed", pattern: /\broot cause confirmed\b/i },
  { id: "grape_guarantees", pattern: /\bgrape guarantees\b/i },
  { id: "benchmark_proven_savings", pattern: /\bbenchmark-proven savings\b/i },
  { id: "semantic_result_is_proof", pattern: /\bsemantic result is proof\b/i },
  { id: "correctness_is_proven", pattern: /\bcorrectness is proven\b/i },
  { id: "fix_is_valid", pattern: /\bfix is valid\b/i },
  { id: "caused_the_bug", pattern: /\bcaused the (?:bug|failure)\b/i }
];

export const SCOPED_DURABLE_CLAIMS_SECTION_TITLE = "Scoped Proof-Backed Claims (Current-Valid)";

export const SCOPED_DURABLE_CLAIMS_SECTION_FOOTER =
  "Claims are proof-backed under narrow policy for the current compile scope. They do not prove correctness, root cause, fix validity, semantic authority, or benchmark savings.";

export const TRUST_WORDING_DISCLAIMERS = {
  observedRunResult:
    "This proves only that Grape observed this run result, not correctness, coverage, or root cause.",
  manifestDependency:
    "This proves manifest entry declaration only, not install state, usage, or lockfile resolution.",
  symbolDeclaration:
    "Parser-backed declaration span exists in scoped source only; it does not prove behavior, correctness, or root cause.",
  sourceExcerpt:
    "This proves exact excerpt existence in scoped source only, not behavior, correctness, or root cause.",
  repositoryRulePrefix: "Repository rule text (not Grape enforcement):",
  compressionOrientationPrefix: "Non-authoritative orientation digest:",
  relationshipIndexHeader:
    "Selection/orientation only; incomplete graph and not proof of behavior or correctness.",
  observedRunCliNote:
    "Durable claim proves observed result only, not correctness, coverage, or root cause.",
  benchmarkFixtureNote:
    "Scripted fixture estimate only; not production savings guarantee or benchmark-proven savings.",
  statusFreshnessAdvisory: "(advisory; not guaranteed agent enforcement)"
} as const;

export function findForbiddenTrustWording(text: string): readonly string[] {
  return FORBIDDEN_TRUST_WORDING_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ id }) => id
  );
}

export function hasForbiddenTrustWording(text: string): boolean {
  return findForbiddenTrustWording(text).length > 0;
}

export function assertConservativeTrustWording(text: string, context: string): void {
  const violations = findForbiddenTrustWording(text);
  if (violations.length > 0) {
    throw new Error(`${context} contains forbidden trust wording: ${violations.join(", ")}`);
  }
}

export function verificationStatusLabel(status: string): string {
  return status === "verified" ? "proof_policy_accepted (verified)" : status;
}

export function statusFreshnessLabel(status: string): string {
  return status === "fresh"
    ? `${status} ${TRUST_WORDING_DISCLAIMERS.statusFreshnessAdvisory}`
    : status;
}

export function compileSuccessTitle(unsafeReasonCount: number, defaultTitle: string): string {
  return unsafeReasonCount > 0 ? "Grape context compiled with safety warnings." : defaultTitle;
}
