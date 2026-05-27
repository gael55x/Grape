export function orderByPreferredRefs<T extends { readonly sourceRef: string }>(
  values: readonly T[],
  preferredSourceRefs: readonly string[]
): readonly T[] {
  const preference = preferenceMap(preferredSourceRefs);
  return [...values].sort((left, right) => {
    const leftRank = preference.get(left.sourceRef) ?? Number.POSITIVE_INFINITY;
    const rightRank = preference.get(right.sourceRef) ?? Number.POSITIVE_INFINITY;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.sourceRef.localeCompare(right.sourceRef);
  });
}

export function orderByPreferredPath<T extends { readonly path: string; readonly name: string }>(
  values: readonly T[],
  preferredSourceRefs: readonly string[]
): readonly T[] {
  const preference = preferenceMap(preferredSourceRefs);
  return [...values].sort((left, right) => {
    const leftRank = preference.get(left.path) ?? Number.POSITIVE_INFINITY;
    const rightRank = preference.get(right.path) ?? Number.POSITIVE_INFINITY;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return `${left.path}:${left.name}`.localeCompare(`${right.path}:${right.name}`);
  });
}

function preferenceMap(preferredSourceRefs: readonly string[]): Map<string, number> {
  return new Map(preferredSourceRefs.map((sourceRef, index) => [sourceRef, index]));
}
