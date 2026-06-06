import {
  compareOptionalEnvironmentDimensions,
  compareOptionalEnvironmentToCurrent,
  compareOptionalFeatureFlagDimensions,
  compareOptionalFeatureFlagsToCurrent,
  compareOptionalPackageRootDimensions,
  compareOptionalPackageRootToCurrent,
  compareOptionalSessionToCurrent,
  compareOptionalSessionDimensions,
  compareRequiredStringDimensions,
  compareRequiredStringToCurrent,
  compareSourceScopeDimensions,
  createScopeComparison,
  resolveDirtyScopeStatus,
  scopeComparisonDetails,
  scopeMatchResult,
  scopeOverlapResult
} from "./scope-dimensions.js";
import type {
  ClaimScopeOverlapResult,
  CurrentClaimScopeResolution,
  CurrentScopeInput,
  ScopeRecord
} from "./scope-types.js";

export function resolveCurrentClaimScope(
  scope: ScopeRecord,
  current: CurrentScopeInput
): CurrentClaimScopeResolution {
  const comparison = createScopeComparison();
  compareRequiredStringToCurrent(comparison, scope, "branch", current.branch);
  compareRequiredStringToCurrent(comparison, scope, "commit", current.commit);
  compareOptionalEnvironmentToCurrent(comparison, scope, current.environment);
  compareOptionalFeatureFlagsToCurrent(comparison, scope, current.featureFlags);
  compareOptionalPackageRootToCurrent(comparison, scope, current.packageRoot);
  if (current.sessionId !== undefined) {
    compareOptionalSessionToCurrent(comparison, scope, current.sessionId);
  }

  const scopeResult = scopeMatchResult(comparison);
  return {
    scopeResult,
    dirtyScopeStatus: resolveDirtyScopeStatus(scope, current.worktreeHash),
    ...scopeComparisonDetails(comparison, scopeResult)
  };
}

export function claimScopesOverlap(left: ScopeRecord, right: ScopeRecord): ClaimScopeOverlapResult {
  const comparison = createScopeComparison();
  compareRequiredStringDimensions(comparison, left, right, "branch");
  compareRequiredStringDimensions(comparison, left, right, "commit");
  compareOptionalEnvironmentDimensions(comparison, left, right);
  compareOptionalFeatureFlagDimensions(comparison, left, right);
  compareOptionalPackageRootDimensions(comparison, left, right);
  compareOptionalSessionDimensions(comparison, left, right);
  compareSourceScopeDimensions(comparison, left, right);

  return scopeOverlapResult(comparison);
}

export function claimScopesCompatibleForSupersession(
  sourceScope: ScopeRecord,
  targetScope: ScopeRecord
): ClaimScopeOverlapResult {
  const comparison = createScopeComparison();
  compareRequiredStringDimensions(comparison, sourceScope, targetScope, "branch");
  compareRequiredStringDimensions(comparison, sourceScope, targetScope, "commit");
  compareRequiredStringDimensions(comparison, sourceScope, targetScope, "sourceRef");
  compareOptionalEnvironmentDimensions(comparison, sourceScope, targetScope);
  compareOptionalFeatureFlagDimensions(comparison, sourceScope, targetScope);
  compareOptionalPackageRootDimensions(comparison, sourceScope, targetScope);
  compareOptionalSessionDimensions(comparison, sourceScope, targetScope);
  compareSourceScopeDimensions(comparison, sourceScope, targetScope);

  return scopeOverlapResult(comparison);
}
