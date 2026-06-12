import type { InMemoryContextDependencyShape } from "../../../../shared/index.js";
import { hashStableJson } from "../hash.js";
import {
  selectedProofSourceExcerpts,
  selectedSources,
  selectedSymbolEdges,
  selectedSymbolNodes
} from "../selection/index.js";
import { sourceProofDependencyId } from "../proofs/source-proofs.js";
import type {
  CompileRepositoryContextArtifactInput,
  RepositoryArtifactSourceInput,
  RepositoryArtifactSymbolEdgeInput
} from "../types.js";

export function dependencyManifest(
  input: CompileRepositoryContextArtifactInput
): InMemoryContextDependencyShape[] {
  const preferredSourceRefs =
    input.taskRetrieval?.rankedSourceRefs ?? input.taskRetrieval?.selectedSourceRefs ?? [];
  const baseScope = currentScope(input);
  const selectedSymbols = selectedSymbolNodes(input.symbolNodes, preferredSourceRefs);
  const dependencies: InMemoryContextDependencyShape[] = [
    {
      id: "repo-snapshot",
      kind: "repo_snapshot",
      ref: input.snapshot.snapshotId,
      hash: input.snapshot.snapshotHash,
      scope: baseScope
    },
    {
      id: "worktree-state",
      kind: "worktree_state",
      ref: input.worktreeStateId,
      hash: input.snapshot.worktreeHash,
      scope: baseScope
    }
  ];

  for (const source of selectedSources(input.sources, preferredSourceRefs)) {
    dependencies.push({
      id: sourceDependencyId(source),
      kind: sourceDependencyKind(source),
      ref: source.sourceRef,
      hash: source.sourceHash,
      scope: {
        ...baseScope,
        sourceScope: source.sourceScope
      }
    });
  }

  for (const excerpt of selectedProofSourceExcerpts(input.sourceExcerpts, preferredSourceRefs)) {
    dependencies.push({
      id: sourceProofDependencyId(excerpt.proofId),
      kind: "proof",
      ref: excerpt.proofId,
      hash: excerpt.excerptHash,
      scope: {
        ...baseScope,
        sourceId: excerpt.sourceId,
        sourceHash: excerpt.sourceHash,
        sourceRef: excerpt.sourceRef,
        sourceScope: excerpt.sourceScope,
        startLine: excerpt.startLine,
        endLine: excerpt.endLine
      }
    });
  }

  for (const claim of input.activeClaims ?? []) {
    dependencies.push({
      id: claimDependencyId(claim.claimId),
      kind: "claim",
      ref: claim.claimId,
      hash: claim.scopeHash,
      scope: {
        ...baseScope,
        claimType: claim.claimType,
        sourceRefs: claim.sourceRefs,
        proofRefs: claim.proofRefs
      }
    });
    claim.proofRefs.forEach((proofRef, index) => {
      const dependencyId = sourceProofDependencyId(proofRef);
      if (dependencies.some((dependency) => dependency.id === dependencyId)) return;
      dependencies.push({
        id: dependencyId,
        kind: "proof",
        ref: proofRef,
        hash: claim.proofHashes?.[index] ?? claim.scopeHash,
        scope: {
          ...baseScope,
          claimId: claim.claimId,
          claimType: claim.claimType,
          sourceRefs: claim.sourceRefs
        }
      });
    });
  }

  for (const artifact of input.compressionArtifacts ?? []) {
    dependencies.push({
      id: compressionDependencyId(artifact.compressionId),
      kind: "compression_artifact",
      ref: artifact.compressionId,
      hash: artifact.outputHash,
      scope: {
        ...baseScope,
        compressionType: artifact.type,
        inputHash: artifact.inputHash,
        inputRefs: artifact.inputRefs,
        inputHashes: artifact.inputHashes,
        policyHash: artifact.policyHash,
        scopeHash: artifact.scopeHash
      }
    });
  }

  for (const node of selectedSymbols) {
    dependencies.push({
      id: symbolDependencyId(node.symbolId),
      kind: "symbol",
      ref: node.symbolId,
      hash: node.bodyHash ?? node.signatureHash ?? hashStableJson(node),
      scope: { ...baseScope, path: node.path, sourceId: node.sourceId }
    });
  }

  for (const edge of selectedSymbolEdgesForDependencies(input, selectedSymbols)) {
    dependencies.push({
      id: symbolDependencyId(edge.edgeId),
      kind: "symbol",
      ref: edge.edgeId,
      hash: hashStableJson(edge),
      scope: {
        ...baseScope,
        edgeType: edge.edgeType,
        fromSymbolId: edge.fromSymbolId,
        target: edge.toRef ?? edge.toSymbolId
      }
    });
  }

  return dependencies;
}

function currentScope(input: CompileRepositoryContextArtifactInput): Record<string, unknown> {
  return {
    repoId: input.snapshot.repoId,
    branch: input.snapshot.branch,
    commit: input.snapshot.commit,
    worktreeHash: input.snapshot.worktreeHash,
    ...(input.currentScope ?? {})
  };
}

function selectedSymbolEdgesForDependencies(
  input: CompileRepositoryContextArtifactInput,
  selectedSymbols: readonly { readonly symbolId: string }[]
): readonly RepositoryArtifactSymbolEdgeInput[] {
  const selectedSymbolIds = new Set(selectedSymbols.map((node) => node.symbolId));
  const selectedById = new Map(
    selectedSymbolEdges(input.symbolEdges, selectedSymbolIds).map((edge) => [edge.edgeId, edge])
  );
  const taskRelationshipRefs = new Set(
    (input.taskRetrieval?.relatedTestRelationships ?? [])
      .map((relationship) => relationship.relationshipRef)
      .filter((ref): ref is string => Boolean(ref))
  );

  for (const edge of input.symbolEdges) {
    if (taskRelationshipRefs.has(edge.edgeId)) selectedById.set(edge.edgeId, edge);
  }

  return [...selectedById.values()].sort((left, right) => left.edgeId.localeCompare(right.edgeId));
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

export function claimDependencyId(claimId: string): string {
  return `claim:${claimId.replace(/^claim:/, "")}`;
}

export function compressionDependencyId(compressionId: string): string {
  return `compression:${compressionId.replace(/^compression:/, "")}`;
}
