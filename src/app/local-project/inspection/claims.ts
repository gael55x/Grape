import path from "node:path";

import { createGitRepoSnapshot } from "../../../core/git/index.js";
import {
  createClaimStorageRepositories,
  createEvidenceStorageRepositories,
  createProofStorageRepositories
} from "../../../core/storage/index.js";
import { ensureConfiguredLocalProjectLayout } from "../setup/configured-layout.js";
import { resolveLocalCurrentValidClaims } from "./claim-resolution.js";
import { withMigratedLocalDatabase } from "../setup/storage.js";
import type { ListLocalClaimsInput, ListLocalClaimsResult } from "../types.js";

export function listLocalClaims(input: ListLocalClaimsInput): ListLocalClaimsResult {
  const now = input.now ?? new Date().toISOString();
  const rootPath = path.resolve(input.rootPath);
  const snapshot = createGitRepoSnapshot({ rootPath, createdAt: now, gitBinary: input.gitBinary });
  const { layout } = ensureConfiguredLocalProjectLayout(snapshot.rootPath);

  return withMigratedLocalDatabase({
    databasePath: layout.databasePath,
    migrationsDir: input.migrationsDir,
    now: () => now,
    operation(database): ListLocalClaimsResult {
      const claimRepositories = createClaimStorageRepositories(database);
      const resolved = resolveLocalCurrentValidClaims({
        claims: claimRepositories.claims,
        claimEdges: claimRepositories.claimEdges,
        proofs: createProofStorageRepositories(database).proofs,
        sources: createEvidenceStorageRepositories(database).sources,
        snapshot
      });

      return {
        rootPath: snapshot.rootPath,
        activeOnly: input.activeOnly !== false,
        claims: input.activeOnly === false ? resolved.visibleClaims : resolved.activeClaims,
        rejectedCount: resolved.rejectedCount,
        warnings: resolved.warnings
      };
    }
  }).value;
}
