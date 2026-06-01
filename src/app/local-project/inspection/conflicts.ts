import path from "node:path";

import { createGitRepoSnapshot } from "../../../core/git/index.js";
import {
  createClaimStorageRepositories,
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
      const edges = claimRepositories.claimEdges.listConflictEdges();
      const conflicts = edges.map((edge) =>
        toConflictSummary(
          edge,
          claimRepositories.claims.get(edge.sourceClaimId),
          claimRepositories.claims.get(edge.targetClaimId)
        )
      );
      return {
        conflicts,
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
    warnings: databaseResult.value.missingClaimCount > 0 ? ["conflict_edge_missing_claim"] : []
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
    sourceClaimId: edge.sourceClaimId,
    targetClaimId: edge.targetClaimId,
    sourceClaim: sourceClaim ? toClaimSummary(sourceClaim) : undefined,
    targetClaim: targetClaim ? toClaimSummary(targetClaim) : undefined,
    createdAt: edge.createdAt
  };
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
