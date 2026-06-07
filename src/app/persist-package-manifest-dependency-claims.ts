import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  createPackageManifestDependencyClaimDraft,
  evaluatePackageManifestDependencyClaimGate,
  extractPackageManifestDependencyEntries,
  packageManifestDependencyProofType,
  type PackageManifestDependencyEntry
} from "../core/claims/index.js";
import type {
  ClaimStorageRepositories,
  ProofRecord,
  ProofStorageRepositories,
  SourceRecord
} from "../core/storage/index.js";

export interface PersistPackageManifestDependencyClaimsInput {
  readonly repositories: ClaimStorageRepositories;
  readonly proofRepositories: ProofStorageRepositories;
  readonly rootPath: string;
  readonly sources: readonly SourceRecord[];
  readonly branch: string;
  readonly commit: string;
  readonly environment?: string;
  readonly worktreeHash: string;
  readonly now: string;
}

export interface PersistPackageManifestDependencyClaimsResult {
  readonly manifestsSeen: number;
  readonly dependenciesSeen: number;
  readonly proofsInserted: number;
  readonly candidatesInserted: number;
  readonly claimsInserted: number;
  readonly rejectedCandidates: readonly { readonly candidateId: string; readonly reason: string }[];
}

export function persistPackageManifestDependencyClaims(
  input: PersistPackageManifestDependencyClaimsInput
): PersistPackageManifestDependencyClaimsResult {
  const rootPath = path.resolve(input.rootPath);
  const entries = input.sources.flatMap((source) => dependencyEntriesForSource(rootPath, source));
  const sourcesById = new Map(input.sources.map((source) => [source.sourceId, source]));
  const rejectedCandidates: { candidateId: string; reason: string }[] = [];
  let proofsInserted = 0;
  let candidatesInserted = 0;
  let claimsInserted = 0;

  for (const entry of entries) {
    const draft = createPackageManifestDependencyClaimDraft({
      branch: input.branch,
      commit: input.commit,
      environment: input.environment,
      worktreeHash: input.worktreeHash,
      entry
    });
    const proof = toProofRecord(entry, draft.proofId, input.now);
    if (input.proofRepositories.proofs.insertOrIgnore(proof)) {
      proofsInserted += 1;
    } else {
      assertMatchingProof(input.proofRepositories.proofs.get(proof.proofId), proof);
    }

    const storedProof = input.proofRepositories.proofs.get(proof.proofId);
    const gate = evaluatePackageManifestDependencyClaimGate({
      source: sourcesById.get(entry.sourceId),
      entry,
      proof: storedProof
    });
    const rejectionReason = gate.accepted ? undefined : gate.reason;

    if (input.repositories.claimCandidates.insertOrIgnore({
      candidateId: draft.candidateId,
      sourceId: entry.sourceId,
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
    attachProofToClaim(input.proofRepositories.proofs, storedProof, draft.claimId);
  }

  return {
    manifestsSeen: input.sources.filter(isNpmManifestSource).length,
    dependenciesSeen: entries.length,
    proofsInserted,
    candidatesInserted,
    claimsInserted,
    rejectedCandidates
  };
}

function dependencyEntriesForSource(
  rootPath: string,
  source: SourceRecord
): readonly PackageManifestDependencyEntry[] {
  if (!isNpmManifestSource(source)) return [];
  const bytes = readManifestBytes(rootPath, source.sourceRef);
  if (!bytes || sha256Buffer(bytes) !== source.sourceHash) return [];

  return extractPackageManifestDependencyEntries({
    source,
    text: bytes.toString("utf8")
  });
}

function readManifestBytes(rootPath: string, sourceRef: string): Buffer | undefined {
  const normalizedRef = normalizeRepoPath(sourceRef);
  if (!normalizedRef) return undefined;
  const absolutePath = path.resolve(rootPath, normalizedRef);
  if (!isInsideRoot(rootPath, absolutePath)) return undefined;

  try {
    const stat = lstatSync(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) return undefined;
    return readFileSync(absolutePath);
  } catch {
    return undefined;
  }
}

function isNpmManifestSource(source: SourceRecord): boolean {
  return (
    source.sourceType === "config_file" &&
    path.posix.basename(source.sourceRef) === "package.json" &&
    sourceKind(source) === "package"
  );
}

function sourceKind(source: SourceRecord): string {
  try {
    const parsed = JSON.parse(source.metadataJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
    const value = (parsed as Record<string, unknown>).sourceKind;
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

function toProofRecord(
  entry: PackageManifestDependencyEntry,
  proofId: string,
  now: string
): ProofRecord {
  return {
    proofId,
    sourceId: entry.sourceId,
    proofType: packageManifestDependencyProofType,
    sourceHash: entry.sourceHash,
    excerptHash: entry.entryHash,
    supportStatus: "direct",
    createdAt: now
  };
}

function attachProofToClaim(
  proofs: ProofStorageRepositories["proofs"],
  proof: ProofRecord | undefined,
  claimId: string
): void {
  if (!proof) throw new Error("cannot attach missing proof to package manifest dependency claim");
  if (proof.claimId === claimId) return;
  if (proof.claimId && proof.claimId !== claimId) {
    throw new Error(`proof ${proof.proofId} is already attached to another claim`);
  }
  if (!proofs.attachClaim({ proofId: proof.proofId, claimId })) {
    throw new Error(`proof ${proof.proofId} could not be attached to claim ${claimId}`);
  }
}

function assertMatchingProof(existing: ProofRecord | undefined, next: ProofRecord): void {
  if (!existing) {
    throw new Error(`proof insert conflict without stored row: ${next.proofId}`);
  }

  assertField("proof source", existing.sourceId, next.sourceId);
  assertField("proof type", existing.proofType, next.proofType);
  assertField("proof source hash", existing.sourceHash, next.sourceHash);
  assertField("proof entry hash", existing.excerptHash, next.excerptHash);
  assertField("proof support status", existing.supportStatus, next.supportStatus);
}

function assertField(label: string, existing: string | undefined, next: string | undefined): void {
  if (existing !== next) {
    throw new Error(`${label} mismatch while persisting package manifest dependency proof`);
  }
}

function isInsideRoot(rootPath: string, absolutePath: string): boolean {
  const relativePath = path.relative(rootPath, absolutePath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function normalizeRepoPath(inputPath: string): string | undefined {
  if (path.isAbsolute(inputPath) || path.win32.isAbsolute(inputPath)) return undefined;
  const normalized = inputPath.replace(/\\/g, "/");
  if (
    normalized === "" ||
    normalized === "." ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    /^[A-Za-z]:\//.test(normalized) ||
    /[\0\r\n\t]/.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function sha256Buffer(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
