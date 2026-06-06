import type { ScopeRecord } from "./scope-types.js";

export type FeatureScopeComparison = "match" | "mismatch" | "unknown" | "not_applicable";

interface NormalizedFeatureScope {
  readonly present: boolean;
  readonly unknown: boolean;
  readonly flags: ReadonlyMap<string, string>;
}

export function compareFeatureScopes(leftScope: ScopeRecord, rightScope: ScopeRecord): FeatureScopeComparison {
  const left = featureScope(leftScope);
  const right = featureScope(rightScope);
  if (!left.present && !right.present) return "not_applicable";
  if (left.unknown || right.unknown) return "unknown";
  if (!left.present || !right.present) return "unknown";

  for (const [key, leftValue] of left.flags) {
    const rightValue = right.flags.get(key);
    if (rightValue !== undefined && rightValue !== leftValue) return "mismatch";
  }
  return "match";
}

function featureScope(scope: ScopeRecord): NormalizedFeatureScope {
  const featureFlag = stringScope(scope, "featureFlag");
  const featureFlags = scope.featureFlags;
  if (featureFlag === "unknown") {
    return { present: true, unknown: true, flags: new Map() };
  }
  if (featureFlag) {
    return { present: true, unknown: false, flags: new Map([[featureFlag, "true"]]) };
  }
  if (featureFlags && typeof featureFlags === "object" && !Array.isArray(featureFlags)) {
    const entries = Object.entries(featureFlags)
      .filter((entry): entry is [string, string | boolean] =>
        typeof entry[1] === "string" || typeof entry[1] === "boolean"
      )
      .sort(([left], [right]) => left.localeCompare(right));
    return {
      present: true,
      unknown: entries.some(([, value]) => value === "unknown"),
      flags: new Map(entries.map(([key, value]) => [key, String(value)]))
    };
  }
  return { present: false, unknown: false, flags: new Map() };
}

function stringScope(scope: ScopeRecord, key: string): string {
  const value = scope[key];
  return typeof value === "string" ? value : "";
}
