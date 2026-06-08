import { createHash } from "node:crypto";

import { packageRootForSourceRef } from "../scope/package-root.js";
import { assertConservativeTrustWording, TRUST_WORDING_DISCLAIMERS } from "../../shared/trust-wording.js";
import { evaluateDurableClaimPolicy } from "./claim-policy.js";

export const symbolDeclarationClaimType = "repository_symbol_declaration_exists";
export const symbolDeclarationProofType = "provider_symbol_declaration";

export interface SymbolDeclarationClaimSource {
  readonly sourceId: string;
  readonly sourceType: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: string;
  readonly trustClass: string;
  readonly privacyStatus: string;
  readonly redactionStatus: string;
  readonly metadataJson: string;
}

export interface SymbolDeclarationClaimSymbol {
  readonly symbolId: string;
  readonly sourceId: string;
  readonly name: string;
  readonly symbolKind: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly bodyHash?: string;
  readonly signatureHash?: string;
  readonly confidence: string;
  readonly metadataJson: string;
}

export interface SymbolDeclarationClaimProof {
  readonly sourceId: string;
  readonly proofType: string;
  readonly sourceHash: string;
  readonly excerptHash: string;
  readonly supportStatus: string;
}

export interface SymbolDeclarationClaimScope {
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
  readonly symbolId: string;
  readonly symbolName: string;
  readonly symbolKind: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly bodyHash: string;
  readonly signatureHash?: string;
}

export interface SymbolDeclarationClaimDraft {
  readonly candidateId: string;
  readonly claimId: string;
  readonly proofId: string;
  readonly subject: string;
  readonly claimType: typeof symbolDeclarationClaimType;
  readonly claimText: string;
  readonly scope: SymbolDeclarationClaimScope;
}

export type SymbolDeclarationClaimGateResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: string };

const allowedSymbolKinds = new Set([
  "function",
  "class",
  "method",
  "interface",
  "type",
  "variable",
  "constant"
]);

export function createSymbolDeclarationClaimDraft(input: {
  readonly branch: string;
  readonly commit: string;
  readonly environment?: string;
  readonly worktreeHash: string;
  readonly source: SymbolDeclarationClaimSource;
  readonly symbol: SymbolDeclarationClaimSymbol;
}): SymbolDeclarationClaimDraft {
  const proofId = symbolDeclarationProofId(input.symbol);
  const packageRoot = packageRootForSourceRef(input.source.sourceRef);
  const bodyHash = input.symbol.bodyHash ?? "";
  const scope: SymbolDeclarationClaimScope = {
    branch: input.branch,
    commit: input.commit,
    ...(input.environment ? { environment: input.environment } : {}),
    ...(packageRoot ? { packageRoot } : {}),
    worktreeHash: input.worktreeHash,
    sourceRef: input.source.sourceRef,
    sourceId: input.source.sourceId,
    sourceScope: input.source.sourceScope,
    sourceHash: input.source.sourceHash,
    proofId,
    excerptHash: bodyHash,
    symbolId: input.symbol.symbolId,
    symbolName: input.symbol.name,
    symbolKind: input.symbol.symbolKind,
    startLine: input.symbol.startLine,
    endLine: input.symbol.endLine,
    bodyHash,
    ...(input.symbol.signatureHash ? { signatureHash: input.symbol.signatureHash } : {})
  };

  return {
    candidateId: `candidate:${stableHash([
      symbolDeclarationClaimType,
      input.symbol.symbolId,
      input.source.sourceHash
    ]).slice(0, 24)}`,
    claimId: symbolDeclarationClaimId(input.symbol),
    proofId,
    subject: `${input.source.sourceRef}#${input.symbol.name}`,
    claimType: symbolDeclarationClaimType,
    claimText: symbolDeclarationClaimText(input),
    scope
  };
}

export function evaluateSymbolDeclarationClaimGate(input: {
  readonly source: SymbolDeclarationClaimSource | undefined;
  readonly symbol: SymbolDeclarationClaimSymbol;
  readonly proof: SymbolDeclarationClaimProof | undefined;
}): SymbolDeclarationClaimGateResult {
  if (!input.source) return { accepted: false, reason: "source_missing" };
  if (!input.proof) return { accepted: false, reason: "proof_missing" };
  if (input.symbol.sourceId !== input.source.sourceId) return { accepted: false, reason: "symbol_source_mismatch" };
  if (input.symbol.confidence !== "high") return { accepted: false, reason: "symbol_confidence_not_high" };
  if (!allowedSymbolKinds.has(input.symbol.symbolKind)) return { accepted: false, reason: "symbol_kind_not_claimable" };
  if (!input.symbol.bodyHash) return { accepted: false, reason: "symbol_body_hash_missing" };
  if (sourceKind(input.source) !== "source") return { accepted: false, reason: "source_kind_not_code" };
  if (symbolExtractor(input.symbol) !== "typescript_ast") {
    return { accepted: false, reason: "symbol_extractor_not_ast" };
  }

  const policy = evaluateDurableClaimPolicy({
    claimType: symbolDeclarationClaimType,
    claimMeaning: "symbol_declaration_exists",
    proofType: input.proof.proofType,
    sourceType: input.source.sourceType,
    supportStatus: input.proof.supportStatus,
    sourceTrustClass: input.source.trustClass,
    sourcePrivacyStatus: input.source.privacyStatus,
    sourceRedactionStatus: input.source.redactionStatus,
    observer: "local_source_reader",
    proofSignalKind: "exact_source"
  });
  if (!policy.accepted) return { accepted: false, reason: policy.reason };
  if (input.proof.sourceId !== input.source.sourceId) return { accepted: false, reason: "proof_source_mismatch" };
  if (input.proof.sourceHash !== input.source.sourceHash) {
    return { accepted: false, reason: "proof_source_hash_mismatch" };
  }
  if (input.proof.excerptHash !== input.symbol.bodyHash) {
    return { accepted: false, reason: "proof_symbol_body_hash_mismatch" };
  }
  return { accepted: true };
}

export function symbolDeclarationClaimId(symbol: SymbolDeclarationClaimSymbol): string {
  return `claim:${stableHash([
    symbolDeclarationClaimType,
    symbol.symbolId,
    symbol.bodyHash ?? ""
  ]).slice(0, 24)}`;
}

export function symbolDeclarationProofId(symbol: SymbolDeclarationClaimSymbol): string {
  return `proof:${stableHash([
    symbolDeclarationProofType,
    symbol.symbolId,
    symbol.bodyHash ?? ""
  ]).slice(0, 24)}`;
}

function symbolDeclarationClaimText(input: {
  readonly source: SymbolDeclarationClaimSource;
  readonly symbol: SymbolDeclarationClaimSymbol;
}): string {
  const claimText = [
    `Symbol ${input.symbol.name} (${input.symbol.symbolKind}) declaration span exists in ${input.source.sourceRef}`,
    `at lines ${input.symbol.startLine}-${input.symbol.endLine}.`,
    TRUST_WORDING_DISCLAIMERS.symbolDeclaration
  ].join(" ");
  assertConservativeTrustWording(claimText, "symbol_declaration_claim_text");
  return claimText;
}

function sourceKind(source: SymbolDeclarationClaimSource): string {
  const metadata = parseMetadata(source.metadataJson);
  return typeof metadata.sourceKind === "string" ? metadata.sourceKind : "";
}

function symbolExtractor(symbol: SymbolDeclarationClaimSymbol): string {
  const metadata = parseMetadata(symbol.metadataJson);
  return typeof metadata.extractor === "string" ? metadata.extractor : "";
}

function parseMetadata(metadataJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function stableHash(parts: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
