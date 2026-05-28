import type {
  ContextDependencyRecord,
  ContextPackItemRecord,
  ContextSentItemRecord
} from "../core/storage/index.js";
import type {
  InMemoryContextArtifactShape,
  InMemoryContextDependencyShape
} from "../shared/index.js";

export interface PartitionPriorContextInput {
  readonly activePriorItems: readonly ContextSentItemRecord[];
  readonly packItems: readonly ContextPackItemRecord[];
  readonly artifact: InMemoryContextArtifactShape;
  readonly listDependenciesByArtifact: (artifactId: string) => readonly ContextDependencyRecord[];
  readonly forceStale: boolean;
}

export interface PartitionPriorContextResult {
  readonly currentPriorItems: readonly ContextSentItemRecord[];
  readonly stalePriorItems: readonly ContextSentItemRecord[];
}

export function partitionPriorContextByStaleness(
  input: PartitionPriorContextInput
): PartitionPriorContextResult {
  if (input.forceStale) {
    return {
      currentPriorItems: [],
      stalePriorItems: input.activePriorItems
    };
  }

  const current = [];
  const stale = [];

  const packItemsById = new Map(input.packItems.map((item) => [item.packItemId, item]));
  const currentSectionsById = new Map(input.artifact.sections.map((section) => [section.id, section]));
  const currentDependenciesById = new Map(
    input.artifact.dependencyManifest.dependencies.map((dependency) => [dependency.id, dependency])
  );
  const priorDependenciesByArtifact = new Map<string, Map<string, ContextDependencyRecord>>();

  for (const item of input.activePriorItems) {
    if (
      isPriorItemStale({
        item,
        packItemsById,
        currentSectionsById,
        currentDependenciesById,
        priorDependenciesByArtifact,
        artifact: input.artifact,
        listDependenciesByArtifact: input.listDependenciesByArtifact
      })
    ) {
      stale.push(item);
    } else {
      current.push(item);
    }
  }

  return {
    currentPriorItems: current,
    stalePriorItems: stale
  };
}

function isPriorItemStale(input: {
  readonly item: ContextSentItemRecord;
  readonly packItemsById: Map<string, ContextPackItemRecord>;
  readonly currentSectionsById: Map<string, InMemoryContextArtifactShape["sections"][number]>;
  readonly currentDependenciesById: Map<string, InMemoryContextDependencyShape>;
  readonly priorDependenciesByArtifact: Map<string, Map<string, ContextDependencyRecord>>;
  readonly artifact: InMemoryContextArtifactShape;
  readonly listDependenciesByArtifact: (artifactId: string) => readonly ContextDependencyRecord[];
}): boolean {
  if (
    input.item.branchName !== input.artifact.input.branch ||
    input.item.commitSha !== input.artifact.input.commit
  ) {
    return true;
  }

  if (input.item.dependencyManifestHash === input.artifact.dependencyManifest.manifestHash) {
    return false;
  }

  const currentSection = input.currentSectionsById.get(input.item.sectionId);
  const priorPackItem = input.packItemsById.get(input.item.sentItemId);
  if (!currentSection || !priorPackItem) return true;

  const priorRefs = parseDependencyRefs(priorPackItem.inputRefsJson);
  if (!sameStringSet(priorRefs, currentSection.dependencyRefs)) return true;

  const priorDependencies = dependenciesForArtifact({
    artifactId: input.item.artifactId,
    cache: input.priorDependenciesByArtifact,
    listDependenciesByArtifact: input.listDependenciesByArtifact
  });

  for (const ref of priorRefs) {
    const priorDependency = priorDependencies.get(ref);
    const currentDependency = input.currentDependenciesById.get(ref);
    if (!priorDependency || !currentDependency) return true;
    if (priorDependency.dependencyHash !== currentDependency.hash) return true;
  }

  return false;
}

function dependenciesForArtifact(input: {
  readonly artifactId: string;
  readonly cache: Map<string, Map<string, ContextDependencyRecord>>;
  readonly listDependenciesByArtifact: (artifactId: string) => readonly ContextDependencyRecord[];
}): Map<string, ContextDependencyRecord> {
  const existing = input.cache.get(input.artifactId);
  if (existing) return existing;

  const mapped = new Map<string, ContextDependencyRecord>();
  for (const dependency of input.listDependenciesByArtifact(input.artifactId)) {
    mapped.set(localDependencyId(input.artifactId, dependency.dependencyId), dependency);
  }
  input.cache.set(input.artifactId, mapped);
  return mapped;
}

function parseDependencyRefs(inputRefsJson: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(inputRefsJson);
    return Array.isArray(parsed) && parsed.every((value) => typeof value === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function localDependencyId(artifactId: string, dependencyId: string): string {
  const prefix = `${artifactId}:`;
  return dependencyId.startsWith(prefix) ? dependencyId.slice(prefix.length) : dependencyId;
}
