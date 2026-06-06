import type { ScopeMatchResult } from "../../shared/index.js";
export type { ScopeMatchResult } from "../../shared/index.js";

export type ScopeRecord = Readonly<Record<string, unknown>>;

export type DirtyScopeStatus = "not_dirty" | "match" | "mismatch" | "unknown";
export type ScopeOverlapStatus = "overlap" | "disjoint" | "unknown";

export interface CurrentScopeInput {
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
  readonly environment?: string;
  readonly featureFlags?: Readonly<Record<string, string | boolean>>;
  readonly packageRoot?: string;
  readonly sessionId?: string;
}

export interface ScopeComparisonDetails {
  readonly matchedDimensions: readonly string[];
  readonly mismatchedDimensions: readonly string[];
  readonly unknownDimensions: readonly string[];
  readonly reason: string;
}

export interface CurrentClaimScopeResolution extends ScopeComparisonDetails {
  readonly scopeResult: ScopeMatchResult;
  readonly dirtyScopeStatus: DirtyScopeStatus;
}

export interface ClaimScopeOverlapResult extends ScopeComparisonDetails {
  readonly status: ScopeOverlapStatus;
}
