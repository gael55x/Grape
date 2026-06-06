import { createHash } from "node:crypto";

import {
  createSymbolDeclarationClaimDraft,
  evaluateSymbolDeclarationClaimGate,
  symbolDeclarationProofType
} from "../core/claims/index.js";
import type { RepositoryArtifactSourceExcerptInput } from "../core/compiler/index.js";
import type {
  ClaimStorageRepositories,
  ProofRecord,
  ProofStorageRepositories,
  SourceRecord,
  SymbolNodeRecord
} from "../core/storage/index.js";

export interface PersistSymbolDeclarationClaimsInput {
  readonly repositories: ClaimStorageRepositories;
  readonly proofRepositories: ProofStorageRepositories;
  readonly sources: readonly SourceRecord[];
  readonly symbolNodes: readonly SymbolNodeRecord[];
  readonly sourceExcerpts: readonly RepositoryArtifactSourceExcerptInput[];
  readonly branch: string;
  readonly commit: string;
  readonly environment?: string;
  readonly worktreeHash: string;
  readonly now: string;
}

export interface PersistSymbolDeclarationClaimsResult {
  readonly symbolsSeen: number;
  readonly proofsInserted: number;
  readonly candidatesInserted: number;
  readonly claimsInserted: number;
  readonly rejectedCandidates: readonly { readonly candidateId: string; readonly reason: string }[];
}

export function persistSymbolDeclarationClaims(
  input: PersistSymbolDeclarationClaimsInput
): PersistSymbolDeclarationClaimsResult {
  const sourcesById = new Map(input.sources.map((source) => [source.sourceId, source]));
  const coveredSymbols = symbolsCoveredByExcerpts(input.symbolNodes, input.sourceExcerpts);
  const rejectedCandidates: { candidateId: string; reason: string }[] = [];
  let proofsInserted = 0;
  let candidatesInserted = 0;
  let claimsInserted = 0;

  for (const symbol of coveredSymbols) {
    const source = sourcesById.get(symbol.sourceId);
    if (!source) continue;
    const draft = createSymbolDeclarationClaimDraft({
      branch: input.branch,
      commit: input.commit,
      environment: input.environment,
      worktreeHash: input.worktreeHash,
      source,
      symbol
    });
    const proof = toSymbolDeclarationProofRecord(symbol, source, draft.proofId, input.now);
    const gate = evaluateSymbolDeclarationClaimGate({ source, symbol, proof });
    const rejectionReason = gate.accepted ? undefined : gate.reason;

    if (input.repositories.claimCandidates.insertOrIgnore({
      candidateId: draft.candidateId,
      sourceId: source.sourceId,
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

  return {
    symbolsSeen: coveredSymbols.length,
    proofsInserted,
    candidatesInserted,
    claimsInserted,
    rejectedCandidates
  };
}

function symbolsCoveredByExcerpts(
  symbolNodes: readonly SymbolNodeRecord[],
  sourceExcerpts: readonly RepositoryArtifactSourceExcerptInput[]
): readonly SymbolNodeRecord[] {
  const excerptsBySourceId = new Map<string, RepositoryArtifactSourceExcerptInput[]>();
  for (const excerpt of sourceExcerpts) {
    const existing = excerptsBySourceId.get(excerpt.sourceId) ?? [];
    existing.push(excerpt);
    excerptsBySourceId.set(excerpt.sourceId, existing);
  }

  return symbolNodes.filter((symbol) =>
    isDeclarationLikeSymbol(symbol) &&
    (excerptsBySourceId.get(symbol.sourceId) ?? []).some((excerpt) =>
      symbol.startLine >= excerpt.startLine && symbol.endLine <= excerpt.endLine
    )
  );
}

function isDeclarationLikeSymbol(symbol: SymbolNodeRecord): boolean {
  return (
    !!symbol.bodyHash &&
    symbol.symbolKind !== "module" &&
    symbol.symbolKind !== "unknown"
  );
}

function toSymbolDeclarationProofRecord(
  symbol: SymbolNodeRecord,
  source: SourceRecord,
  proofId: string,
  now: string
): ProofRecord {
  return {
    proofId,
    sourceId: source.sourceId,
    proofType: symbolDeclarationProofType,
    sourceHash: source.sourceHash,
    excerptHash: symbol.bodyHash ?? "",
    supportStatus: "direct",
    createdAt: now
  };
}

function attachProofToClaim(
  proofs: ProofStorageRepositories["proofs"],
  proof: ProofRecord | undefined,
  claimId: string
): void {
  if (!proof) throw new Error("cannot attach missing proof to symbol declaration claim");
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
  if (existing !== next) throw new Error(`${label} mismatch while persisting symbol declaration proof`);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
