import type { InMemoryContextDependencyShape } from "../../../../shared/index.js";
import { packageContextDependencyRefsForSourceRefs } from "../package-context.js";

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

export function sourceAndPackageContextDependencyRefs(
  sourceRefs: readonly string[],
  dependencies: readonly InMemoryContextDependencyShape[]
): string[] {
  return [
    ...sourceRefs.map((sourceRef) => sourceDependencyRefForSourceRef(sourceRef, dependencies)),
    ...packageContextDependencyRefsForSourceRefs(sourceRefs, dependencies)
  ].filter((ref): ref is string => Boolean(ref));
}
