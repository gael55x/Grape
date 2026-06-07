import type { InMemoryContextDependencyShape } from "../../../../shared/index.js";

export function sectionDependencyRefs(
  requiredRefs: readonly string[],
  scopedRefs: readonly string[]
): string[] {
  return [...new Set([...requiredRefs, ...scopedRefs])];
}

export function sourceDependencyRefForSourceRef(
  sourceRef: string,
  dependencies: readonly InMemoryContextDependencyShape[]
): string | undefined {
  return dependencies.find((dependency) => dependency.ref === sourceRef)?.id;
}

export function dependencyIdForRef(
  ref: string,
  dependencies: readonly InMemoryContextDependencyShape[]
): string | undefined {
  return dependencies.find((dependency) => dependency.ref === ref)?.id;
}
