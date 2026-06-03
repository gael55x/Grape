import type { ContextPackItemShape } from "../shared/index.js";

const compactScopeKeys = [
  "branch",
  "commit",
  "sourceScope",
  "environment",
  "featureFlag",
  "path",
  "symbol",
  "route",
  "test"
] as const;

export function compactAgentContextPackItems(
  items: readonly ContextPackItemShape[]
): readonly ContextPackItemShape[] {
  return items.map((item) => ({
    ...item,
    inputRefs: item.inputRefs.map((ref) => ({
      ...ref,
      scope: compactPackScope(ref.scope)
    }))
  }));
}

function compactPackScope(scope: Record<string, unknown>): Record<string, unknown> {
  const compacted: Record<string, unknown> = {};
  for (const key of compactScopeKeys) {
    const value = scope[key];
    if (isCompactScopeValue(value)) compacted[key] = value;
  }
  return compacted;
}

function isCompactScopeValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
