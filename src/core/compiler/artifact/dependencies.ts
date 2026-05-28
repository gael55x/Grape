import type {
  ContextDependencyShape,
  ContextInputKind,
  ContextInputShape,
  ContextScopeShape,
  DependencyStrength,
  InMemoryContextArtifactShape,
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../../shared/index.js";
import { isScaffoldSectionSafetyCritical } from "./sections.js";

export function compressionArtifactRefs(dependencies: readonly ContextDependencyShape[]): string[] {
  return [...new Set(
    dependencies
      .filter((dependency) => dependency.kind === "compression_artifact")
      .map((dependency) => dependency.ref)
  )];
}

export function requiredDependencyIds(sections: readonly InMemoryContextSectionShape[]): Set<string> {
  const required = new Set<string>();
  for (const section of sections) {
    if (!section.pinned && !section.exactRequired && !isScaffoldSectionSafetyCritical(section)) continue;
    for (const dependencyRef of section.dependencyRefs) required.add(dependencyRef);
  }
  return required;
}

export function toContextDependency(
  artifact: InMemoryContextArtifactShape,
  dependency: InMemoryContextDependencyShape,
  requiredIds: ReadonlySet<string>
): ContextDependencyShape {
  const kind = contextInputKindForDependency(dependency.kind);
  return {
    id: dependency.id,
    kind,
    ref: dependency.ref,
    hash: dependency.hash,
    scope: contextScopeForDependency(artifact, dependency),
    strength: dependencyStrengthForKind(kind),
    requiredForSafety: requiredIds.has(dependency.id),
    invalidates: invalidationTargetsForKind(kind)
  };
}

export function toContextInput(dependency: ContextDependencyShape): ContextInputShape {
  return {
    id: dependency.id,
    kind: dependency.kind,
    ref: dependency.ref,
    hash: dependency.hash,
    scope: dependency.scope,
    dependencyStrength: dependency.strength,
    requiredForSafety: dependency.requiredForSafety
  };
}

function contextInputKindForDependency(
  kind: InMemoryContextDependencyShape["kind"]
): ContextInputKind {
  switch (kind) {
    case "source_file":
      return "file";
    default:
      return kind;
  }
}

function contextScopeForDependency(
  artifact: InMemoryContextArtifactShape,
  dependency: InMemoryContextDependencyShape
): ContextScopeShape {
  return {
    repoId: artifact.input.repoId,
    branch: artifact.input.branch,
    commit: artifact.input.commit,
    taskId: artifact.input.taskId,
    sessionId: artifact.input.sessionId,
    ...dependency.scope
  };
}

function dependencyStrengthForKind(kind: ContextInputKind): DependencyStrength {
  switch (kind) {
    case "symbol":
      return "symbol";
    case "test":
      return "test";
    case "rule":
      return "rule";
    case "config":
    case "lockfile":
      return "config";
    case "compression_artifact":
      return "compression";
    default:
      return "direct";
  }
}

function invalidationTargetsForKind(
  kind: ContextInputKind
): readonly ContextDependencyShape["invalidates"][number][] {
  if (kind === "proof") return ["proof", "section", "artifact", "sent_item"];
  if (kind === "compression_artifact") return ["compression_artifact", "section", "artifact", "sent_item"];
  return ["section", "artifact", "sent_item"];
}
