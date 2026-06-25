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
import {
  assertMatchingProof,
  attachProofToClaim,
  insertClaimCandidate,
  insertVerifiedClaim
} from "./persist-claim-records.js";

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

    if (insertClaimCandidate({
      repositories: input.repositories,
      draft,
      sourceId: source.sourceId,
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
        context: "symbol declaration"
      });
    }

    const inserted = insertVerifiedClaim({ repositories: input.repositories, draft, now: input.now });
    if (inserted) claimsInserted += 1;
    attachProofToClaim(
      input.proofRepositories.proofs,
      input.proofRepositories.proofs.get(proof.proofId),
      draft.claimId,
      "symbol declaration"
    );
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
