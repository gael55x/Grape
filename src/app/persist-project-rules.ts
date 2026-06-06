import { createHash } from "node:crypto";

import {
  createProjectRuleClaimDraft,
  detectProjectRuleConflicts,
  evaluateProjectRuleClaimGate,
  parseProjectRuleLines,
  projectRuleProofId,
  projectRuleProofType
} from "../core/claims/index.js";
import { assertArtifactTextHasNoSecrets } from "../core/security/index.js";
import type { RepositoryArtifactSourceExcerptInput } from "../core/compiler/index.js";
import type {
  ClaimStorageRepositories,
  ProofRecord,
  ProofStorageRepositories,
  SourceRecord
} from "../core/storage/index.js";

export interface PersistProjectRuleClaimsInput {
  readonly repositories: ClaimStorageRepositories;
  readonly proofRepositories: ProofStorageRepositories;
  readonly sources: readonly SourceRecord[];
  readonly sourceExcerpts: readonly RepositoryArtifactSourceExcerptInput[];
  readonly branch: string;
  readonly commit: string;
  readonly environment?: string;
  readonly worktreeHash: string;
  readonly now: string;
}

export interface PersistProjectRuleClaimsResult {
  readonly rulesSeen: number;
  readonly proofsInserted: number;
  readonly candidatesInserted: number;
  readonly claimsInserted: number;
  readonly conflictEdgesInserted: number;
  readonly rejectedCandidates: readonly { readonly candidateId: string; readonly reason: string }[];
}

export function persistProjectRuleClaims(input: PersistProjectRuleClaimsInput): PersistProjectRuleClaimsResult {
  const sourcesById = new Map(input.sources.map((source) => [source.sourceId, source]));
  const rejectedCandidates: { candidateId: string; reason: string }[] = [];
  let rulesSeen = 0;
  let proofsInserted = 0;
  let candidatesInserted = 0;
  let claimsInserted = 0;
  let conflictEdgesInserted = 0;

  for (const excerpt of input.sourceExcerpts.filter((candidate) => candidate.sourceType === "rule_file")) {
    for (const rule of parseProjectRuleLines(excerpt)) {
      rulesSeen += 1;
      assertArtifactTextHasNoSecrets(rule.ruleText, "project rule claim");
      const draft = createProjectRuleClaimDraft({
        branch: input.branch,
        commit: input.commit,
        environment: input.environment,
        worktreeHash: input.worktreeHash,
        rule
      });
      const proof = toProjectRuleProofRecord(rule, input.now);
      const source = sourcesById.get(rule.sourceId);
      const gate = evaluateProjectRuleClaimGate({ source, proof, rule });
      const rejectionReason = gate.accepted ? undefined : gate.reason;

      if (input.repositories.claimCandidates.insertOrIgnore({
        candidateId: draft.candidateId,
        sourceId: rule.sourceId,
        subject: draft.subject,
        claimType: draft.claimType,
        claimText: draft.claimText,
        scopeJson: JSON.stringify(draft.scope),
        rejectionReason,
        createdAt: input.now
      })) {
        candidatesInserted += 1;
      }

      if (!gate.accepted) {
        rejectedCandidates.push({ candidateId: draft.candidateId, reason: gate.reason });
        continue;
      }

      if (input.proofRepositories.proofs.insertOrIgnore(proof)) {
        proofsInserted += 1;
      } else {
        assertMatchingProof(input.proofRepositories.proofs.get(proof.proofId), proof);
      }

      const scopeJson = JSON.stringify(draft.scope);
      const inserted = input.repositories.claims.insertOrIgnore({
        claimId: draft.claimId,
        subject: draft.subject,
        claimType: draft.claimType,
        claimText: draft.claimText,
        scopeJson,
        scopeHash: sha256(scopeJson),
        verificationStatus: "verified",
        createdAt: input.now,
        updatedAt: input.now
      });
      if (inserted) claimsInserted += 1;
      attachProofToClaim(input.proofRepositories.proofs, input.proofRepositories.proofs.get(proof.proofId), draft.claimId);
    }
  }

  for (const conflict of detectProjectRuleConflicts(input.repositories.claims.list())) {
    if (input.repositories.claimEdges.insertOrIgnore({
      ...conflict,
      authority: {
        createdBy: "deterministic_rule",
        confidence: 0.5,
        reason: "deterministic project-rule opposing-topic review",
        metadataJson: "{}",
        createdAt: input.now
      },
      createdAt: input.now
    })) {
      conflictEdgesInserted += 1;
    }
  }

  return {
    rulesSeen,
    proofsInserted,
    candidatesInserted,
    claimsInserted,
    conflictEdgesInserted,
    rejectedCandidates
  };
}

function toProjectRuleProofRecord(
  rule: ReturnType<typeof parseProjectRuleLines>[number],
  now: string
): ProofRecord {
  return {
    proofId: projectRuleProofId(rule),
    sourceId: rule.sourceId,
    proofType: projectRuleProofType,
    sourceHash: rule.sourceHash,
    excerptHash: rule.ruleHash,
    supportStatus: "direct",
    createdAt: now
  };
}

function attachProofToClaim(
  proofs: ProofStorageRepositories["proofs"],
  proof: ProofRecord | undefined,
  claimId: string
): void {
  if (!proof) throw new Error("cannot attach missing proof to project rule claim");
  if (proof.claimId === claimId) return;
  if (proof.claimId && proof.claimId !== claimId) {
    throw new Error(`proof ${proof.proofId} is already attached to another claim`);
  }
  if (!proofs.attachClaim({ proofId: proof.proofId, claimId })) {
    throw new Error(`proof ${proof.proofId} could not be attached to claim ${claimId}`);
  }
}

function assertMatchingProof(existing: ProofRecord | undefined, next: ProofRecord): void {
  if (!existing) throw new Error(`proof insert conflict without stored row: ${next.proofId}`);
  assertField("proof source", existing.sourceId, next.sourceId);
  assertField("proof type", existing.proofType, next.proofType);
  assertField("proof source hash", existing.sourceHash, next.sourceHash);
  assertField("proof excerpt hash", existing.excerptHash, next.excerptHash);
  assertField("proof support status", existing.supportStatus, next.supportStatus);
}

function assertField(label: string, existing: string | undefined, next: string | undefined): void {
  if (existing !== next) throw new Error(`${label} mismatch while persisting project rule proof`);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
