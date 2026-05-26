import path from "node:path";

import { createGitRepoSnapshot } from "../../core/git/index.js";
import { resolveInMemoryCurrentValidCandidates } from "../../core/retrieval/index.js";
import {
  createClaimStorageRepositories,
  createEvidenceStorageRepositories,
  createProofStorageRepositories
} from "../../core/storage/index.js";
import type {
  ClaimRecord,
  ProofRecord,
  SourceRecord
} from "../../core/storage/index.js";
import type { CurrentValidCandidate } from "../../core/retrieval/index.js";
import type { NonEmptyArray } from "../../shared/index.js";
import { ensureLocalProjectLayout, readLocalProjectConfig } from "./config.js";
import { withMigratedLocalDatabase } from "./storage.js";
import type { ListLocalClaimsInput, ListLocalClaimsResult, LocalClaimSummary } from "./types.js";

export function listLocalClaims(input: ListLocalClaimsInput): ListLocalClaimsResult {
  const now = input.now ?? new Date().toISOString();
  const rootPath = path.resolve(input.rootPath);
  const snapshot = createGitRepoSnapshot({ rootPath, createdAt: now, gitBinary: input.gitBinary });
  const layout = ensureLocalProjectLayout(snapshot.rootPath);
  const config = readLocalProjectConfig(layout.configPath);
  if (!config) throw new Error("Grape config is missing. Run grape init --connect.");
  if (path.resolve(config.project.rootPath) !== snapshot.rootPath) {
    throw new Error("Grape config root path does not match the current repository path.");
  }

  return withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database): ListLocalClaimsResult {
      const claimRepositories = createClaimStorageRepositories(database);
      const proofRepositories = createProofStorageRepositories(database);
      const evidenceRepositories = createEvidenceStorageRepositories(database);
      const claims = claimRepositories.claims.list();
      const currentFiles = new Map(snapshot.files.map((file) => [file.path, file.sha256]));
      const resolved = resolveInMemoryCurrentValidCandidates(
        claims.map((claim) =>
          toCurrentValidCandidate({
            claim,
            proofs: proofRepositories.proofs.listByClaim(claim.claimId),
            sourceForProof: (proof) => evidenceRepositories.sources.get(proof.sourceId),
            currentFiles,
            snapshot
          })
        )
      );
      const activeIds = new Set(resolved.active.map((claim) => claim.id));
      const visibleClaims = input.activeOnly === false
        ? claims
        : claims.filter((claim) => activeIds.has(claim.claimId));

      return {
        rootPath: snapshot.rootPath,
        activeOnly: input.activeOnly !== false,
        claims: visibleClaims.map((claim) =>
          toClaimSummary(claim, proofRepositories.proofs.listByClaim(claim.claimId))
        ),
        rejectedCount: resolved.rejected.length,
        warnings: resolved.warnings
      };
    }
  }).value;
}

function toCurrentValidCandidate(input: {
  readonly claim: ClaimRecord;
  readonly proofs: readonly ProofRecord[];
  readonly sourceForProof: (proof: ProofRecord) => SourceRecord | undefined;
  readonly currentFiles: ReadonlyMap<string, string>;
  readonly snapshot: ReturnType<typeof createGitRepoSnapshot>;
}): CurrentValidCandidate {
  const scope = parseScope(input.claim.scopeJson);
  const sources = input.proofs.map(input.sourceForProof);
  return {
    id: input.claim.claimId,
    text: input.claim.claimText,
    sourceRefs: sources.map((source) => source?.sourceRef ?? stringScope(scope, "sourceRef")).filter(Boolean),
    proofRefs: proofRefsForCurrentValid(input.proofs),
    verificationStatus: input.claim.verificationStatus,
    scopeResult: scopeMatchesCurrentSnapshot(scope, input.snapshot) ? "match" : "mismatch",
    sourceHashStatus: sourceHashesMatch(input.proofs, sources, input.currentFiles),
    proofHashStatus: proofHashesMatch(input.proofs, scope),
    contradictionStatus: "none",
    privacyStatus: sources.every((source) => source?.privacyStatus === "allowed" && source.redactionStatus !== "blocked")
      ? "allowed"
      : "blocked",
    dirtyScopeStatus: dirtyScopeStatus(scope, input.snapshot)
  };
}

function toClaimSummary(claim: ClaimRecord, proofs: readonly ProofRecord[]): LocalClaimSummary {
  const scope = parseScope(claim.scopeJson);
  return {
    claimId: claim.claimId,
    subject: claim.subject,
    claimType: claim.claimType,
    claimText: claim.claimText,
    verificationStatus: claim.verificationStatus,
    scope,
    proofRefs: proofs.map((proof) => proof.proofId),
    sourceRefs: [...new Set(proofs.map((proof) => stringScope(scope, "sourceRef") || proof.sourceId))],
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt
  };
}

function proofRefsForCurrentValid(proofs: readonly ProofRecord[]): NonEmptyArray<string> {
  return proofs.map((proof) => proof.proofId) as unknown as NonEmptyArray<string>;
}

function scopeMatchesCurrentSnapshot(
  scope: Record<string, unknown>,
  snapshot: ReturnType<typeof createGitRepoSnapshot>
): boolean {
  return stringScope(scope, "branch") === snapshot.branch && stringScope(scope, "commit") === snapshot.commit;
}

function sourceHashesMatch(
  proofs: readonly ProofRecord[],
  sources: readonly (SourceRecord | undefined)[],
  currentFiles: ReadonlyMap<string, string>
): CurrentValidCandidate["sourceHashStatus"] {
  if (proofs.length === 0) return "unknown";
  for (let index = 0; index < proofs.length; index += 1) {
    const source = sources[index];
    if (!source) return "mismatch";
    if (source.sourceHash !== proofs[index].sourceHash) return "mismatch";
    if (currentFiles.get(source.sourceRef) !== proofs[index].sourceHash) return "mismatch";
  }
  return "match";
}

function proofHashesMatch(
  proofs: readonly ProofRecord[],
  scope: Record<string, unknown>
): CurrentValidCandidate["proofHashStatus"] {
  if (proofs.length === 0) return "unknown";
  const expectedExcerptHash = stringScope(scope, "excerptHash");
  if (!expectedExcerptHash) return "unknown";
  return proofs.every((proof) => proof.excerptHash === expectedExcerptHash) ? "match" : "mismatch";
}

function dirtyScopeStatus(
  scope: Record<string, unknown>,
  snapshot: ReturnType<typeof createGitRepoSnapshot>
): CurrentValidCandidate["dirtyScopeStatus"] {
  if (stringScope(scope, "sourceScope") === "committed") return "not_dirty";
  return stringScope(scope, "worktreeHash") === snapshot.worktreeHash ? "match" : "mismatch";
}

function parseScope(scopeJson: string): Record<string, unknown> {
  const parsed = JSON.parse(scopeJson) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("claim scope is not an object");
  }
  return parsed as Record<string, unknown>;
}

function stringScope(scope: Record<string, unknown>, key: string): string {
  const value = scope[key];
  return typeof value === "string" ? value : "";
}
