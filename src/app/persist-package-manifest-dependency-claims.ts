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
import {
  assertMatchingProof,
  attachProofToClaim,
  insertClaimCandidate,
  insertVerifiedClaim
} from "./persist-claim-records.js";

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
      assertMatchingProof(input.proofRepositories.proofs.get(proof.proofId), proof, {
        context: "package manifest dependency",
        excerptHashLabel: "proof entry hash"
      });
    }

    const storedProof = input.proofRepositories.proofs.get(proof.proofId);
    const gate = evaluatePackageManifestDependencyClaimGate({
      source: sourcesById.get(entry.sourceId),
      entry,
      proof: storedProof
    });
    const rejectionReason = gate.accepted ? undefined : gate.reason;

    if (insertClaimCandidate({
      repositories: input.repositories,
      draft,
      sourceId: entry.sourceId,
      rejectionReason,
      now: input.now
    })) {
      candidatesInserted += 1;
    }

    if (!gate.accepted) {
      rejectedCandidates.push({ candidateId: draft.candidateId, reason: gate.reason });
      continue;
    }

    const inserted = insertVerifiedClaim({ repositories: input.repositories, draft, now: input.now });
    if (inserted) claimsInserted += 1;
    attachProofToClaim(input.proofRepositories.proofs, storedProof, draft.claimId, "package manifest dependency");
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

function sha256Buffer(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
