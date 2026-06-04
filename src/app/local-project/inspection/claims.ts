import path from "node:path";

import { createGitRepoSnapshot } from "../../../core/git/index.js";
import {
  createClaimStorageRepositories,
  createEvidenceStorageRepositories,
  createProofStorageRepositories
} from "../../../core/storage/index.js";
import { ensureLocalProjectLayout, readLocalProjectConfig } from "../setup/config.js";
import { resolveLocalCurrentValidClaims } from "./claim-resolution.js";
import { withMigratedLocalDatabase } from "../setup/storage.js";
import type { ListLocalClaimsInput, ListLocalClaimsResult } from "../types.js";

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
