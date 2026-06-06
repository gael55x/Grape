import path from "node:path";
import { createHash } from "node:crypto";

import { createGitRepoSnapshot } from "../../../core/git/index.js";
import {
  claimEdgeAuthoritySummary,
  claimEdgeCanResolveConflict,
  type ClaimEdgeAuthoritySummary
} from "../../../core/claims/index.js";
import {
  createClaimStorageRepositories,
  type ClaimEdgeType,
  type ClaimEdgeRecord,
  type ClaimRecord
} from "../../../core/storage/index.js";
import { ensureLocalProjectLayout, readLocalProjectConfig } from "../setup/config.js";
import { withMigratedLocalDatabase } from "../setup/storage.js";

export interface LocalConflictClaimSummary {
  readonly claimId: string;
  readonly subject: string;
  readonly claimType: string;
  readonly claimText: string;
  readonly verificationStatus: ClaimRecord["verificationStatus"];
  readonly scopeHash: string;
}

export interface LocalConflictSummary {
  readonly edgeId: string;
  readonly edgeType: ClaimEdgeRecord["edgeType"];
  readonly authority: ClaimEdgeAuthoritySummary;
  readonly sourceClaimId: string;
  readonly targetClaimId: string;
  readonly sourceClaim?: LocalConflictClaimSummary;
  readonly targetClaim?: LocalConflictClaimSummary;
  readonly createdAt: string;
}

export interface ListLocalConflictsInput {
  readonly rootPath: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface ListLocalConflictsResult {
  readonly rootPath: string;
  readonly branch: string;
  readonly headCommit: string;
  readonly dirtyWorktree: boolean;
  readonly conflicts: readonly LocalConflictSummary[];
  readonly warnings: readonly string[];
}

export interface ResolveLocalConflictInput {
  readonly rootPath: string;
  readonly edgeId: string;
  readonly resolution: Extract<ClaimEdgeType, "coexists_with" | "variant_of">;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface ResolveLocalConflictResult {
  readonly rootPath: string;
  readonly edgeId: string;
  readonly resolutionEdgeId: string;
  readonly resolution: Extract<ClaimEdgeType, "coexists_with" | "variant_of">;
  readonly resolved: boolean;
}

const conflictEdgeTypes = new Set<ClaimEdgeType>(["contradicts", "needs_review", "violates", "unknown_scope_overlap"]);
const resolutionEdgeTypes = new Set<ClaimEdgeType>(["coexists_with", "variant_of", "supersedes"]);

export function listLocalConflicts(input: ListLocalConflictsInput): ListLocalConflictsResult {
  const rootPath = path.resolve(input.rootPath);
  const snapshot = createGitRepoSnapshot({
    rootPath,
    createdAt: input.now ?? new Date().toISOString(),
    gitBinary: input.gitBinary
  });
  const layout = ensureLocalProjectLayout(snapshot.rootPath);
  const config = readLocalProjectConfig(layout.configPath);
  if (!config) throw new Error("Grape config is missing. Run grape init --connect.");
  if (path.resolve(config.project.rootPath) !== snapshot.rootPath) {
    throw new Error("Grape config root path does not match the current repository path.");
  }

  const databaseResult = withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => input.now ?? new Date().toISOString(),
    operation(database) {
      const claimRepositories = createClaimStorageRepositories(database);
      const allEdges = claimRepositories.claimEdges.list();
      const open = openConflictEdges(allEdges);
      const conflicts = open.edges.map((edge) =>
        toConflictSummary(
          edge,
          claimRepositories.claims.get(edge.sourceClaimId),
          claimRepositories.claims.get(edge.targetClaimId)
        )
      );
      return {
        conflicts,
        authorityWarnings: open.warnings,
        missingClaimCount: conflicts.filter(
          (conflict) => conflict.sourceClaim === undefined || conflict.targetClaim === undefined
        ).length
      };
    }
  });

  return {
    rootPath: snapshot.rootPath,
    branch: snapshot.branch,
    headCommit: snapshot.commit,
    dirtyWorktree: snapshot.worktreeStatus !== "clean",
    conflicts: databaseResult.value.conflicts,
    warnings: [
      ...databaseResult.value.authorityWarnings,
      ...(databaseResult.value.missingClaimCount > 0 ? ["conflict_edge_missing_claim"] : [])
    ]
  };
}

export function resolveLocalConflict(input: ResolveLocalConflictInput): ResolveLocalConflictResult {
  const rootPath = path.resolve(input.rootPath);
  const snapshot = createGitRepoSnapshot({
    rootPath,
    createdAt: input.now ?? new Date().toISOString(),
    gitBinary: input.gitBinary
  });
  const layout = ensureLocalProjectLayout(snapshot.rootPath);
  const config = readLocalProjectConfig(layout.configPath);
  if (!config) throw new Error("Grape config is missing. Run grape init --connect.");
  if (path.resolve(config.project.rootPath) !== snapshot.rootPath) {
    throw new Error("Grape config root path does not match the current repository path.");
  }

  const now = input.now ?? new Date().toISOString();
  const resolutionEdgeId = withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database) {
      const claimRepositories = createClaimStorageRepositories(database);
      const edge = claimRepositories.claimEdges.get(input.edgeId);
      if (!edge) throw new Error(`conflict edge not found: ${input.edgeId}`);
      if (!conflictEdgeTypes.has(edge.edgeType)) {
        throw new Error(`edge is not an open conflict: ${input.edgeId}`);
      }
      const record: ClaimEdgeRecord = {
        edgeId: conflictResolutionEdgeId(edge, input.resolution),
        sourceClaimId: edge.sourceClaimId,
        targetClaimId: edge.targetClaimId,
        edgeType: input.resolution,
        authority: {
          createdBy: "user_confirmation",
          confidence: 1,
          reason: "manual local conflict resolution",
          metadataJson: "{}",
          createdAt: now
        },
        createdAt: now
      };
      claimRepositories.claimEdges.insertOrIgnore(record);
      return record.edgeId;
    }
  }).value;

  return {
    rootPath: snapshot.rootPath,
    edgeId: input.edgeId,
    resolutionEdgeId,
    resolution: input.resolution,
    resolved: true
  };
}

function openConflictEdges(edges: readonly ClaimEdgeRecord[]): {
  readonly edges: readonly ClaimEdgeRecord[];
  readonly warnings: readonly string[];
} {
  const resolutionsByPair = new Map<string, string>();
  const warnings: string[] = [];
  for (const edge of edges) {
    if (!resolutionEdgeTypes.has(edge.edgeType)) continue;
    const authority = claimEdgeCanResolveConflict(edge);
    if (authority.warning) warnings.push(authority.warning);
    if (!authority.allowed) continue;
    const previous = resolutionsByPair.get(claimPairKey(edge));
    if (!previous || previous < edge.createdAt) resolutionsByPair.set(claimPairKey(edge), edge.createdAt);
  }

  return {
    edges: edges.filter((edge) => {
      if (!conflictEdgeTypes.has(edge.edgeType)) return false;
      const resolvedAt = resolutionsByPair.get(claimPairKey(edge));
      return !resolvedAt || resolvedAt < edge.createdAt;
    }),
    warnings
  };
}

function toConflictSummary(
  edge: ClaimEdgeRecord,
  sourceClaim: ClaimRecord | undefined,
  targetClaim: ClaimRecord | undefined
): LocalConflictSummary {
  return {
    edgeId: edge.edgeId,
    edgeType: edge.edgeType,
    authority: claimEdgeAuthoritySummary(edge),
    sourceClaimId: edge.sourceClaimId,
    targetClaimId: edge.targetClaimId,
    sourceClaim: sourceClaim ? toClaimSummary(sourceClaim) : undefined,
    targetClaim: targetClaim ? toClaimSummary(targetClaim) : undefined,
    createdAt: edge.createdAt
  };
}

function conflictResolutionEdgeId(
  edge: ClaimEdgeRecord,
  resolution: Extract<ClaimEdgeType, "coexists_with" | "variant_of">
): string {
  return `edge:${sha256(JSON.stringify(["claim_conflict_resolution_v1", edge.edgeId, resolution])).slice(0, 24)}`;
}

function claimPairKey(edge: Pick<ClaimEdgeRecord, "sourceClaimId" | "targetClaimId">): string {
  return [edge.sourceClaimId, edge.targetClaimId].sort().join("\0");
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function toClaimSummary(claim: ClaimRecord): LocalConflictClaimSummary {
  return {
    claimId: claim.claimId,
    subject: claim.subject,
    claimType: claim.claimType,
    claimText: claim.claimText,
    verificationStatus: claim.verificationStatus,
    scopeHash: claim.scopeHash
  };
}
