import type {
  InMemoryContextArtifactShape,
  InMemoryContextRequest
} from "../../../shared/index.js";
import { assertInMemoryContextArtifactShape } from "../artifact/in-memory-context-artifact.js";
import { dependencyManifest } from "./dependencies.js";
import { hashStableJson, hashStableParts } from "./hash.js";
import {
  repositoryContextArtifactHash,
  repositoryContextManifestHash
} from "./integrity.js";
import { maxListedEdges, maxListedSources, maxListedSymbols } from "./selection.js";
import { evaluateRepositoryRiskPolicy } from "./policy/risk.js";
import { contextSections } from "./sections/sections.js";
import type { CompileRepositoryContextArtifactInput } from "./types.js";

export function compileRepositoryContextArtifact(
  input: CompileRepositoryContextArtifactInput
): InMemoryContextArtifactShape {
  const dependencies = dependencyManifest(input);
  const sections = contextSections(input, dependencies);
  const manifestHash = repositoryContextManifestHash({
    dependencies,
    snapshotId: input.snapshot.snapshotId,
    worktreeStateId: input.worktreeStateId
  });
  const request = artifactInput(input);
  const artifactIdentityHash = hashStableJson({ request, manifestHash, createdAt: input.createdAt });
  const artifactId = `artifact:${hashStableParts([artifactIdentityHash]).slice(0, 24)}`;
  const manifest = {
    manifestId: `manifest:${artifactId.slice("artifact:".length)}`,
    dependencies,
    createdAt: input.createdAt,
    hashAlgorithm: "sha256" as const,
    manifestHash
  };
  const artifactHash = repositoryContextArtifactHash({
    input: request,
    sections,
    dependencyManifest: {
      dependencies: manifest.dependencies,
      hashAlgorithm: manifest.hashAlgorithm,
      manifestHash: manifest.manifestHash
    }
  });

  return assertInMemoryContextArtifactShape({
    artifactId,
    input: request,
    sections,
    dependencyManifest: manifest,
    warnings: compileWarnings(input),
    unsafeReasons: unsafeReasons(input),
    createdAt: input.createdAt,
    artifactHash
  });
}

function artifactInput(input: CompileRepositoryContextArtifactInput): InMemoryContextRequest {
  return {
    taskId: input.taskId,
    sessionId: input.sessionId,
    repoId: input.snapshot.repoId,
    branch: input.snapshot.branch,
    commit: input.snapshot.commit,
    worktreeHash: input.snapshot.worktreeHash,
    taskType: input.taskType,
    riskOverlays: [...input.riskOverlays],
    userRequestHash: input.userRequestHash
  };
}

function compileWarnings(input: CompileRepositoryContextArtifactInput): string[] {
  const riskPolicy = evaluateRepositoryRiskPolicy(input);
  const warnings = ["repository_artifact_uses_lightweight_index"];
  if (input.sources.length > maxListedSources) warnings.push("source_manifest_truncated");
  if (input.symbolNodes.length > maxListedSymbols) warnings.push("symbol_nodes_truncated");
  if (input.symbolEdges.length > maxListedEdges) warnings.push("symbol_edges_truncated");
  if (input.snapshot.worktreeStatus !== "clean") warnings.push("dirty_worktree_context");
  warnings.push(...riskPolicy.warnings);
  warnings.push(...(input.taskRetrieval?.warnings ?? []));
  return warnings;
}

function unsafeReasons(input: CompileRepositoryContextArtifactInput): string[] {
  return [...evaluateRepositoryRiskPolicy(input).unsafeReasons];
}
