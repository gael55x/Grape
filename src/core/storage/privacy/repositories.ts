import type { DatabaseSync } from "node:sqlite";

import { applySqliteConnectionPolicy } from "../sqlite-policy.js";

export interface LocalDataInventoryCounts {
  readonly setup: {
    readonly schemaMigrations: number;
    readonly projects: number;
    readonly repos: number;
  };
  readonly repositoryState: {
    readonly repoSnapshots: number;
    readonly worktreeStates: number;
    readonly sources: number;
    readonly sourceRejections: number;
  };
  readonly trust: {
    readonly claims: number;
    readonly claimCandidates: number;
    readonly proofs: number;
    readonly claimEdges: number;
    readonly claimEdgeAuthority: number;
    readonly projectRules: number;
  };
  readonly indexes: {
    readonly symbolNodes: number;
    readonly symbolEdges: number;
    readonly ftsEntries: number;
    readonly ftsEntryText: number;
  };
  readonly context: {
    readonly contextSessions: number;
    readonly sessionEvents: number;
    readonly contextArtifacts: number;
    readonly contextDependencies: number;
    readonly contextSentItems: number;
    readonly omittedContextItems: number;
    readonly contextPackItems: number;
  };
  readonly compression: {
    readonly compressionArtifacts: number;
    readonly compressionInputs: number;
  };
  readonly audit: {
    readonly auditEvents: number;
  };
}

export interface PrivacyStorageRepositories {
  countLocalDataRows(): LocalDataInventoryCounts;
}

export function createPrivacyStorageRepositories(database: DatabaseSync): PrivacyStorageRepositories {
  applySqliteConnectionPolicy(database);

  return {
    countLocalDataRows() {
      return {
        setup: {
          schemaMigrations: countTableRows(database, "schema_migrations"),
          projects: countTableRows(database, "projects"),
          repos: countTableRows(database, "repos")
        },
        repositoryState: {
          repoSnapshots: countTableRows(database, "repo_snapshots"),
          worktreeStates: countTableRows(database, "worktree_states"),
          sources: countTableRows(database, "sources"),
          sourceRejections: countTableRows(database, "source_rejections")
        },
        trust: {
          claims: countTableRows(database, "claims"),
          claimCandidates: countTableRows(database, "claim_candidates"),
          proofs: countTableRows(database, "proofs"),
          claimEdges: countTableRows(database, "claim_edges"),
          claimEdgeAuthority: countTableRows(database, "claim_edge_authority"),
          projectRules: countTableRows(database, "project_rules")
        },
        indexes: {
          symbolNodes: countTableRows(database, "symbol_nodes"),
          symbolEdges: countTableRows(database, "symbol_edges"),
          ftsEntries: countTableRows(database, "fts_entries"),
          ftsEntryText: countTableRows(database, "fts_entry_text")
        },
        context: {
          contextSessions: countTableRows(database, "context_sessions"),
          sessionEvents: countTableRows(database, "session_events"),
          contextArtifacts: countTableRows(database, "context_artifacts"),
          contextDependencies: countTableRows(database, "context_dependencies"),
          contextSentItems: countTableRows(database, "context_sent_items"),
          omittedContextItems: countTableRows(database, "omitted_context_items"),
          contextPackItems: countTableRows(database, "context_pack_items")
        },
        compression: {
          compressionArtifacts: countTableRows(database, "compression_artifacts"),
          compressionInputs: countTableRows(database, "compression_inputs")
        },
        audit: {
          auditEvents: countTableRows(database, "audit_events")
        }
      };
    }
  };
}

function countTableRows(database: DatabaseSync, tableName: string): number {
  return Number(database.prepare(`SELECT count(*) AS count FROM ${tableName}`).get()?.count ?? 0);
}
