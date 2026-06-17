import { createHash } from "node:crypto";

import type { SourceScope } from "../../shared/index.js";
import { packageRootForSourceRefWithMetadata } from "../scope/package-root.js";
import { assertConservativeTrustWording, TRUST_WORDING_DISCLAIMERS } from "../../shared/trust-wording.js";
import { evaluateDurableClaimPolicy } from "./claim-policy.js";

export const projectRuleClaimType = "project_rule";
export const projectRuleProofType = "exact_project_rule_excerpt";

export interface ProjectRuleClaimSource {
  readonly sourceId: string;
  readonly sourceType: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: SourceScope;
  readonly trustClass: string;
  readonly privacyStatus: string;
  readonly redactionStatus: string;
}

export interface ProjectRuleClaimProof {
  readonly proofId: string;
  readonly sourceId: string;
  readonly proofType: string;
  readonly sourceHash: string;
  readonly excerptHash: string;
  readonly supportStatus: string;
}

export interface ProjectRuleExcerptInput {
  readonly proofId: string;
  readonly sourceId: string;
  readonly sourceType: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: string;
  readonly excerpt: string;
  readonly excerptHash: string;
  readonly startLine: number;
  readonly endLine: number;
}

export interface ProjectRuleLine {
  readonly sourceId: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: string;
  readonly sourceExcerptProofId: string;
  readonly sourceExcerptHash: string;
  readonly line: number;
  readonly ruleText: string;
  readonly ruleHash: string;
  readonly parser: "deterministic_rule_line_v1";
}

export interface ProjectRuleClaimScope {
  readonly branch: string;
  readonly commit: string;
  readonly environment?: string;
  readonly packageRoot?: string;
  readonly worktreeHash: string;
  readonly sourceRef: string;
  readonly sourceId: string;
  readonly sourceScope: string;
  readonly sourceHash: string;
  readonly proofId: string;
  readonly excerptHash: string;
  readonly sourceExcerptProofId: string;
  readonly sourceExcerptHash: string;
  readonly ruleHash: string;
  readonly line: number;
  readonly parser: "deterministic_rule_line_v1";
}

export interface ProjectRuleClaimDraft {
  readonly candidateId: string;
  readonly claimId: string;
  readonly subject: string;
  readonly claimType: typeof projectRuleClaimType;
  readonly claimText: string;
  readonly scope: ProjectRuleClaimScope;
}

export type ProjectRuleClaimGateResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: string };

export function parseProjectRuleLines(excerpt: ProjectRuleExcerptInput): readonly ProjectRuleLine[] {
  if (excerpt.sourceType !== "rule_file") return [];
  return excerpt.excerpt
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .flatMap((line, index) => {
      const lineNumber = excerpt.startLine + index;
      if (lineNumber > excerpt.endLine) return [];
      const ruleText = ruleTextFromLine(line);
      if (!ruleText) return [];
      return [{
        sourceId: excerpt.sourceId,
        sourceRef: excerpt.sourceRef,
        sourceHash: excerpt.sourceHash,
        sourceScope: excerpt.sourceScope,
        sourceExcerptProofId: excerpt.proofId,
        sourceExcerptHash: excerpt.excerptHash,
        line: lineNumber,
        ruleText,
        ruleHash: sha256(ruleText),
        parser: "deterministic_rule_line_v1" as const
      }];
    });
}

export function createProjectRuleClaimDraft(input: {
  readonly branch: string;
  readonly commit: string;
  readonly environment?: string;
  readonly worktreeHash: string;
  readonly rule: ProjectRuleLine;
  readonly sourceMetadataJson?: string;
}): ProjectRuleClaimDraft {
  const proofId = projectRuleProofId(input.rule);
  const packageRoot = packageRootForSourceRefWithMetadata(input.rule.sourceRef, input.sourceMetadataJson);
  const scope: ProjectRuleClaimScope = {
    branch: input.branch,
    commit: input.commit,
    ...(input.environment ? { environment: input.environment } : {}),
    ...(packageRoot ? { packageRoot } : {}),
    worktreeHash: input.worktreeHash,
    sourceRef: input.rule.sourceRef,
    sourceId: input.rule.sourceId,
    sourceScope: input.rule.sourceScope,
    sourceHash: input.rule.sourceHash,
    proofId,
    excerptHash: input.rule.ruleHash,
    sourceExcerptProofId: input.rule.sourceExcerptProofId,
    sourceExcerptHash: input.rule.sourceExcerptHash,
    ruleHash: input.rule.ruleHash,
    line: input.rule.line,
    parser: input.rule.parser
  };

  return {
    candidateId: `candidate:${stableHash(["project_rule", proofId]).slice(0, 24)}`,
    claimId: projectRuleClaimId(input.rule),
    subject: `${input.rule.sourceRef}:${input.rule.line}`,
    claimType: projectRuleClaimType,
    claimText: projectRuleClaimText(input.rule),
    scope
  };
}

function projectRuleClaimText(rule: ProjectRuleLine): string {
  const generatedPrefix = `${TRUST_WORDING_DISCLAIMERS.repositoryRulePrefix} Project rule from ${rule.sourceRef} line ${rule.line}:`;
  assertConservativeTrustWording(generatedPrefix, "project_rule_claim_text");
  return `${generatedPrefix} ${rule.ruleText}`;
}

export function evaluateProjectRuleClaimGate(input: {
  readonly source: ProjectRuleClaimSource | undefined;
  readonly proof: ProjectRuleClaimProof | undefined;
  readonly rule: ProjectRuleLine;
}): ProjectRuleClaimGateResult {
  if (!input.source) return { accepted: false, reason: "source_missing" };
  if (!input.proof) return { accepted: false, reason: "proof_missing" };
  const policy = evaluateDurableClaimPolicy({
    claimType: projectRuleClaimType,
    claimMeaning: "project_rule_exists",
    proofType: input.proof.proofType,
    sourceType: input.source.sourceType,
    supportStatus: input.proof.supportStatus,
    sourceTrustClass: input.source.trustClass,
    sourcePrivacyStatus: input.source.privacyStatus,
    sourceRedactionStatus: input.source.redactionStatus,
    observer: "local_source_reader",
    proofSignalKind: "exact_rule"
  });
  if (!policy.accepted) return { accepted: false, reason: policy.reason };
  if (input.source.sourceId !== input.rule.sourceId) return { accepted: false, reason: "source_id_mismatch" };
  if (input.source.sourceHash !== input.rule.sourceHash) return { accepted: false, reason: "source_hash_mismatch" };
  if (input.proof.sourceId !== input.rule.sourceId) return { accepted: false, reason: "proof_source_mismatch" };
  if (input.proof.sourceHash !== input.rule.sourceHash) {
    return { accepted: false, reason: "proof_source_hash_mismatch" };
  }
  if (input.proof.excerptHash !== input.rule.ruleHash) {
    return { accepted: false, reason: "proof_rule_hash_mismatch" };
  }
  return { accepted: true };
}

export function projectRuleClaimId(rule: ProjectRuleLine): string {
  return `claim:${stableHash(["project_rule", rule.sourceId, rule.sourceHash, rule.line, rule.ruleHash]).slice(0, 24)}`;
}

export function projectRuleProofId(rule: ProjectRuleLine): string {
  return `proof:${stableHash(["project_rule", rule.sourceId, rule.sourceHash, rule.line, rule.ruleHash]).slice(0, 24)}`;
}

function ruleTextFromLine(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed === "```" || trimmed.startsWith("#") || trimmed.startsWith("|")) return undefined;
  const listItem = trimmed.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
  const text = (listItem?.[1] ?? trimmed).replace(/^\[[ xX]\]\s+/, "").trim();
  if (!text || /^[-=_]{3,}$/.test(text)) return undefined;
  return isNormativeRuleText(text) || listItem ? text : undefined;
}

function isNormativeRuleText(text: string): boolean {
  return /\b(always|avoid|cannot|can't|do not|don't|ensure|forbidden|keep|must|never|only|prefer|required|respect|run|shall|should|use)\b/i.test(text);
}

function stableHash(parts: readonly unknown[]): string {
  return sha256(JSON.stringify(parts));
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
