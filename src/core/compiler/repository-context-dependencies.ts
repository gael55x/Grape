import type { InMemoryContextDependencyShape } from "../../shared/index.js";
import { hashStableJson } from "./repository-context-hash.js";
import {
  selectedSources,
  selectedSymbolEdges,
  selectedSymbolNodes
} from "./repository-context-selection.js";
import type {
  CompileRepositoryContextArtifactInput,
  RepositoryArtifactSourceInput
} from "./repository-context-types.js";

export function dependencyManifest(
  input: CompileRepositoryContextArtifactInput
): InMemoryContextDependencyShape[] {
  const dependencies: InMemoryContextDependencyShape[] = [
    {
      id: "repo-snapshot",
      kind: "repo_snapshot",
      ref: input.snapshot.snapshotId,
      hash: input.snapshot.snapshotHash,
      scope: { branch: input.snapshot.branch, commit: input.snapshot.commit }
    },
    {
      id: "worktree-state",
      kind: "worktree_state",
      ref: input.worktreeStateId,
      hash: input.snapshot.worktreeHash,
      scope: { branch: input.snapshot.branch, commit: input.snapshot.commit }
    }
  ];

  for (const source of selectedSources(input.sources)) {
    dependencies.push({
      id: sourceDependencyId(source),
      kind: sourceDependencyKind(source),
      ref: source.sourceRef,
      hash: source.sourceHash,
      scope: {
        branch: input.snapshot.branch,
        commit: input.snapshot.commit,
        sourceScope: source.sourceScope
      }
    });
  }

  for (const node of selectedSymbolNodes(input.symbolNodes)) {
    dependencies.push({
      id: symbolDependencyId(node.symbolId),
      kind: "symbol",
      ref: node.symbolId,
      hash: node.bodyHash ?? node.signatureHash ?? hashStableJson(node),
      scope: { branch: input.snapshot.branch, path: node.path, sourceId: node.sourceId }
    });
  }

  for (const edge of selectedSymbolEdges(input.symbolEdges)) {
    dependencies.push({
      id: symbolDependencyId(edge.edgeId),
      kind: "symbol",
      ref: edge.edgeId,
      hash: hashStableJson(edge),
      scope: {
        branch: input.snapshot.branch,
        edgeType: edge.edgeType,
        fromSymbolId: edge.fromSymbolId,
        target: edge.toRef ?? edge.toSymbolId
      }
    });
  }

  return dependencies;
}

function sourceDependencyKind(source: RepositoryArtifactSourceInput): InMemoryContextDependencyShape["kind"] {
  switch (source.sourceType) {
    case "rule_file":
      return "rule";
    case "config_file":
      return "config";
    case "lockfile":
      return "lockfile";
    case "test_run":
      return "test";
    default:
      return "source_file";
  }
}

function sourceDependencyId(source: RepositoryArtifactSourceInput): string {
  return `source:${source.sourceId.replace(/^source:/, "")}`;
}

function symbolDependencyId(symbolId: string): string {
  return `symbol:${symbolId.replace(/^symbol(?:_edge)?:/, "")}`;
}
