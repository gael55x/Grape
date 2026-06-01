import { createHash } from "node:crypto";

export interface ProjectRuleConflictClaim {
  readonly claimId: string;
  readonly claimType: string;
  readonly claimText: string;
}

export interface ProjectRuleConflictCandidate {
  readonly edgeId: string;
  readonly sourceClaimId: string;
  readonly targetClaimId: string;
  readonly edgeType: "needs_review";
}

type RulePolarity = "affirmative" | "negative" | "unknown";

const negativePattern = /\b(avoid|cannot|can't|do not|don't|forbidden|must not|never|should not)\b/i;
const affirmativePattern = /\b(always|ensure|keep|must|only|prefer|required|run|should|use)\b/i;
const conflictOverlapThreshold = 0.5;
const conflictMinimumOverlap = 2;
const projectRulePrefix = /^Project rule from .+? line \d+:\s*/;
const tokenStopWords = new Set([
  "always",
  "avoid",
  "cannot",
  "cant",
  "code",
  "do",
  "dont",
  "ensure",
  "file",
  "files",
  "for",
  "forbidden",
  "in",
  "keep",
  "must",
  "never",
  "not",
  "only",
  "prefer",
  "required",
  "run",
  "should",
  "the",
  "to",
  "use",
  "with"
]);

export function detectProjectRuleConflicts(
  claims: readonly ProjectRuleConflictClaim[]
): readonly ProjectRuleConflictCandidate[] {
  const projectRules = claims
    .filter((claim) => claim.claimType === "project_rule")
    .map((claim) => ({ claim, parsed: parseRuleConflictSignal(claim.claimText) }))
    .filter((entry) => entry.parsed.polarity !== "unknown" && entry.parsed.tokens.size > 0);
  const conflicts: ProjectRuleConflictCandidate[] = [];

  for (let leftIndex = 0; leftIndex < projectRules.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < projectRules.length; rightIndex += 1) {
      const left = projectRules[leftIndex];
      const right = projectRules[rightIndex];
      if (!left || !right) continue;
      if (left.parsed.polarity === right.parsed.polarity) continue;
      if (!hasConflictOverlap(left.parsed.tokens, right.parsed.tokens)) continue;
      const [sourceClaimId, targetClaimId] = orderedClaimPair(left.claim.claimId, right.claim.claimId);
      conflicts.push({
        edgeId: projectRuleConflictEdgeId(sourceClaimId, targetClaimId),
        sourceClaimId,
        targetClaimId,
        edgeType: "needs_review"
      });
    }
  }

  return conflicts;
}

export function projectRuleConflictEdgeId(sourceClaimId: string, targetClaimId: string): string {
  return `edge:${sha256(JSON.stringify(["project_rule_conflict_v1", sourceClaimId, targetClaimId])).slice(0, 24)}`;
}

function parseRuleConflictSignal(claimText: string): { readonly polarity: RulePolarity; readonly tokens: ReadonlySet<string> } {
  const ruleText = claimText.replace(projectRulePrefix, "");
  return {
    polarity: rulePolarity(ruleText),
    tokens: new Set(tokenizeRuleTopic(ruleText))
  };
}

function rulePolarity(ruleText: string): RulePolarity {
  if (negativePattern.test(ruleText)) return "negative";
  if (affirmativePattern.test(ruleText)) return "affirmative";
  return "unknown";
}

function tokenizeRuleTopic(ruleText: string): readonly string[] {
  const tokens = ruleText
    .toLowerCase()
    .replace(/can't/g, "cant")
    .replace(/don't/g, "dont")
    .match(/[a-z][a-z0-9]{2,}/g) ?? [];
  return [...new Set(tokens.filter((token) => !tokenStopWords.has(token)))];
}

function hasConflictOverlap(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  const intersection = [...left].filter((token) => right.has(token));
  if (intersection.length < conflictMinimumOverlap) return false;
  const smallerSize = Math.min(left.size, right.size);
  return smallerSize > 0 && intersection.length / smallerSize >= conflictOverlapThreshold;
}

function orderedClaimPair(left: string, right: string): readonly [string, string] {
  return left.localeCompare(right) <= 0 ? [left, right] : [right, left];
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
