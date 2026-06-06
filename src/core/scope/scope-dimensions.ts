import type {
  ClaimScopeOverlapResult,
  DirtyScopeStatus,
  ScopeMatchResult,
  ScopeOverlapStatus,
  ScopeRecord
} from "./scope-types.js";
import { compareFeatureScopes } from "./feature-scope.js";

export interface MutableScopeComparison {
  readonly matchedDimensions: string[];
  readonly mismatchedDimensions: string[];
  readonly unknownDimensions: string[];
}

type DimensionComparison = "match" | "mismatch" | "unknown" | "not_applicable";

export function createScopeComparison(): MutableScopeComparison {
  return {
    matchedDimensions: [],
    mismatchedDimensions: [],
    unknownDimensions: []
  };
}

export function compareRequiredStringToCurrent(
  comparison: MutableScopeComparison,
  scope: ScopeRecord,
  key: string,
  currentValue: string
): void {
  const value = stringScope(scope, key);
  if (!value || !currentValue) {
    comparison.unknownDimensions.push(key);
    return;
  }
  recordDimension(comparison, key, value === currentValue ? "match" : "mismatch");
}

export function compareOptionalStringToCurrent(
  comparison: MutableScopeComparison,
  scope: ScopeRecord,
  key: string,
  currentValue: string | undefined
): void {
  const result = compareOptionalStringValues(stringScope(scope, key), currentValue ?? "");
  recordOptionalDimension(comparison, key, result);
}

export function compareOptionalSessionToCurrent(
  comparison: MutableScopeComparison,
  scope: ScopeRecord,
  currentSessionId: string
): void {
  const sessionId = stringScope(scope, "sessionId");
  if (!sessionId) return;
  recordDimension(comparison, "sessionId", sessionId === currentSessionId ? "match" : "mismatch");
}

export function compareOptionalEnvironmentToCurrent(
  comparison: MutableScopeComparison,
  scope: ScopeRecord,
  currentEnvironment: string | undefined
): void {
  const result = compareEnvironmentValues(stringScope(scope, "environment"), currentEnvironment ?? "");
  recordOptionalDimension(comparison, "environment", result);
}

export function compareOptionalFeatureFlagsToCurrent(
  comparison: MutableScopeComparison,
  scope: ScopeRecord,
  currentFeatureFlags: Readonly<Record<string, string | boolean>> | undefined
): void {
  const result = compareFeatureScopes(
    scope,
    currentFeatureFlags ? { featureFlags: currentFeatureFlags } : {}
  );
  recordOptionalDimension(comparison, "featureFlags", result);
}

export function compareOptionalPackageRootToCurrent(
  comparison: MutableScopeComparison,
  scope: ScopeRecord,
  currentPackageRoot: string | undefined
): void {
  const scopedPackageRoot = packageRoot(scope);
  if (!scopedPackageRoot) return;
  if (!currentPackageRoot) {
    comparison.unknownDimensions.push("packageRoot");
    return;
  }
  recordDimension(
    comparison,
    "packageRoot",
    scopedPackageRoot === currentPackageRoot ? "match" : "mismatch"
  );
}

export function compareRequiredStringDimensions(
  comparison: MutableScopeComparison,
  left: ScopeRecord,
  right: ScopeRecord,
  key: string
): void {
  const leftValue = stringScope(left, key);
  const rightValue = stringScope(right, key);
  if (!leftValue || !rightValue) {
    comparison.unknownDimensions.push(key);
    return;
  }
  recordDimension(comparison, key, leftValue === rightValue ? "match" : "mismatch");
}

export function compareOptionalEnvironmentDimensions(
  comparison: MutableScopeComparison,
  left: ScopeRecord,
  right: ScopeRecord
): void {
  const result = compareEnvironmentValues(stringScope(left, "environment"), stringScope(right, "environment"));
  recordOptionalDimension(comparison, "environment", result);
}

export function compareOptionalFeatureFlagDimensions(
  comparison: MutableScopeComparison,
  left: ScopeRecord,
  right: ScopeRecord
): void {
  const result = compareFeatureScopes(left, right);
  recordOptionalDimension(comparison, "featureFlags", result);
}

export function compareOptionalPackageRootDimensions(
  comparison: MutableScopeComparison,
  left: ScopeRecord,
  right: ScopeRecord
): void {
  const result = compareOptionalStringValues(packageRoot(left), packageRoot(right));
  recordOptionalDimension(comparison, "packageRoot", result);
}

export function compareOptionalSessionDimensions(
  comparison: MutableScopeComparison,
  left: ScopeRecord,
  right: ScopeRecord
): void {
  const result = compareOptionalStringValues(stringScope(left, "sessionId"), stringScope(right, "sessionId"));
  recordOptionalDimension(comparison, "sessionId", result);
}

export function compareSourceScopeDimensions(
  comparison: MutableScopeComparison,
  left: ScopeRecord,
  right: ScopeRecord
): void {
  const leftSourceScope = stringScope(left, "sourceScope");
  const rightSourceScope = stringScope(right, "sourceScope");
  if (!leftSourceScope || !rightSourceScope) {
    comparison.unknownDimensions.push("sourceScope");
    return;
  }
  if (leftSourceScope === "committed" && rightSourceScope === "committed") {
    comparison.matchedDimensions.push("sourceScope");
    return;
  }
  if (leftSourceScope === "committed" || rightSourceScope === "committed") {
    comparison.mismatchedDimensions.push("sourceScope");
    return;
  }

  const leftWorktreeHash = stringScope(left, "worktreeHash");
  const rightWorktreeHash = stringScope(right, "worktreeHash");
  if (!leftWorktreeHash || !rightWorktreeHash) {
    comparison.unknownDimensions.push("worktreeHash");
    return;
  }
  recordDimension(comparison, "worktreeHash", leftWorktreeHash === rightWorktreeHash ? "match" : "mismatch");
}

export function resolveDirtyScopeStatus(scope: ScopeRecord, currentWorktreeHash: string): DirtyScopeStatus {
  const sourceScope = stringScope(scope, "sourceScope");
  if (sourceScope === "committed") return "not_dirty";
  if (sourceScope !== "staged" && sourceScope !== "unstaged" && sourceScope !== "untracked" && sourceScope !== "external") {
    return "unknown";
  }

  const worktreeHash = stringScope(scope, "worktreeHash");
  if (!worktreeHash || !currentWorktreeHash) return "unknown";
  return worktreeHash === currentWorktreeHash ? "match" : "mismatch";
}

export function scopeMatchResult(comparison: MutableScopeComparison): ScopeMatchResult {
  if (comparison.mismatchedDimensions.length > 0) return "mismatch";
  if (comparison.unknownDimensions.length > 0) return "unknown";
  return "match";
}

export function scopeOverlapResult(comparison: MutableScopeComparison): ClaimScopeOverlapResult {
  const status: ScopeOverlapStatus =
    comparison.mismatchedDimensions.length > 0
      ? "disjoint"
      : comparison.unknownDimensions.length > 0
        ? "unknown"
        : "overlap";
  return {
    status,
    ...scopeComparisonDetails(comparison, status)
  };
}

export function scopeComparisonDetails(
  comparison: MutableScopeComparison,
  status: ScopeMatchResult | ScopeOverlapStatus
) {
  const mismatched = [...new Set(comparison.mismatchedDimensions)].sort();
  const unknown = [...new Set(comparison.unknownDimensions)].sort();
  const matched = [...new Set(comparison.matchedDimensions)].sort();
  return {
    matchedDimensions: matched,
    mismatchedDimensions: mismatched,
    unknownDimensions: unknown,
    reason: scopeReason(status, { matched, mismatched, unknown })
  };
}

function recordDimension(
  comparison: MutableScopeComparison,
  dimension: string,
  result: Extract<DimensionComparison, "match" | "mismatch">
): void {
  if (result === "match") {
    comparison.matchedDimensions.push(dimension);
  } else {
    comparison.mismatchedDimensions.push(dimension);
  }
}

function recordOptionalDimension(
  comparison: MutableScopeComparison,
  dimension: string,
  result: DimensionComparison
): void {
  if (result === "not_applicable") return;
  if (result === "match" || result === "mismatch") {
    recordDimension(comparison, dimension, result);
  } else {
    comparison.unknownDimensions.push(dimension);
  }
}

function compareEnvironmentValues(left: string, right: string): DimensionComparison {
  if (!left && !right) return "not_applicable";
  if (left === "unknown" || right === "unknown") return "unknown";
  if (left === "*" || right === "*") return "match";
  if (!left || !right) return "unknown";
  return left === right ? "match" : "mismatch";
}

function compareOptionalStringValues(left: string, right: string): DimensionComparison {
  if (!left && !right) return "not_applicable";
  if (!left || !right) return "unknown";
  return left === right ? "match" : "mismatch";
}

function packageRoot(scope: ScopeRecord): string {
  return stringScope(scope, "packageRoot") || stringScope(scope, "serviceRoot");
}

function scopeReason(
  status: ScopeMatchResult | ScopeOverlapStatus,
  dimensions: {
    readonly matched: readonly string[];
    readonly mismatched: readonly string[];
    readonly unknown: readonly string[];
  }
): string {
  if (dimensions.mismatched.length > 0) {
    return `scope ${status}: mismatched ${dimensions.mismatched.join(", ")}`;
  }
  if (dimensions.unknown.length > 0) {
    return `scope ${status}: unknown ${dimensions.unknown.join(", ")}`;
  }
  return dimensions.matched.length > 0
    ? `scope ${status}: matched ${dimensions.matched.join(", ")}`
    : `scope ${status}: no scoped dimensions`;
}

function stringScope(scope: ScopeRecord, key: string): string {
  const value = scope[key];
  return typeof value === "string" ? value : "";
}
