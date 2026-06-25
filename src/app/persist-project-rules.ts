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
import { packageRootsBySourceRefFromMetadata } from "../core/scope/index.js";
import type {
  ClaimStorageRepositories,
  ProofRecord,
  ProofStorageRepositories,
  SourceRecord
} from "../core/storage/index.js";
import {
  assertMatchingProof,
  attachProofToClaim,
  insertClaimCandidate,
  insertVerifiedClaim
} from "./persist-claim-records.js";

export interface PersistProjectRuleClaimsInput {
  readonly repositories: ClaimStorageRepositories;
  readonly proofRepositories: ProofStorageRepositories;
  readonly sources: readonly SourceRecord[];
  readonly sourceMetadata?: readonly { readonly sourceRef: string; readonly metadataJson: string | undefined }[];
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
  const sourceMetadataByRef = sourceMetadataBySourceRef(input.sourceMetadata ?? []);
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
      const source = sourcesById.get(rule.sourceId);
      const draft = createProjectRuleClaimDraft({
        branch: input.branch,
        commit: input.commit,
        environment: input.environment,
        worktreeHash: input.worktreeHash,
        rule,
        sourceMetadataJson: sourceMetadataByRef.get(rule.sourceRef)
      });
      const proof = toProjectRuleProofRecord(rule, input.now);
      const gate = evaluateProjectRuleClaimGate({ source, proof, rule });
      const rejectionReason = gate.accepted ? undefined : gate.reason;

      if (insertClaimCandidate({
        repositories: input.repositories,
        draft,
        sourceId: rule.sourceId,
        rejectionReason,
        now: input.now
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
        assertMatchingProof(input.proofRepositories.proofs.get(proof.proofId), proof, {
          context: "project rule"
        });
      }

      const inserted = insertVerifiedClaim({ repositories: input.repositories, draft, now: input.now });
      if (inserted) claimsInserted += 1;
      attachProofToClaim(
        input.proofRepositories.proofs,
        input.proofRepositories.proofs.get(proof.proofId),
        draft.claimId,
        "project rule"
      );
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

function sourceMetadataBySourceRef(
  metadata: readonly { readonly sourceRef: string; readonly metadataJson: string | undefined }[]
): ReadonlyMap<string, string> {
  const packageRoots = packageRootsBySourceRefFromMetadata(metadata);
  const result = new Map<string, string>();
  for (const source of metadata) {
    if (packageRoots.has(source.sourceRef) && source.metadataJson) {
      result.set(source.sourceRef, source.metadataJson);
    }
  }
  return result;
}
