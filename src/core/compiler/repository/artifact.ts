import type {
  EnvironmentScope,
  InMemoryContextArtifactShape,
  InMemoryContextRequest
} from "../../../shared/index.js";
import { classifyTaskRetrievalConfidence } from "../../retrieval/index.js";
import { assertInMemoryContextArtifactShape } from "../artifact/in-memory-context-artifact.js";
import { dependencyManifest } from "./manifest/dependencies.js";
import { hashStableJson, hashStableParts } from "./hash.js";
import {
  repositoryContextArtifactHash,
  repositoryContextManifestHash
} from "./validation/integrity.js";
import { maxListedEdges, maxListedSources, maxListedSymbols } from "./selection/index.js";
import { evaluateRepositoryRiskPolicy } from "./policy/risk.js";
import { contextSections } from "./sections/sections.js";
import type { CompileRepositoryContextArtifactInput } from "./types.js";

export function compileRepositoryContextArtifact(
  input: CompileRepositoryContextArtifactInput
): InMemoryContextArtifactShape {
  const normalizedInput = normalizeTaskRetrievalConfidence(input);
  const dependencies = dependencyManifest(normalizedInput);
  const sections = contextSections(normalizedInput, dependencies);
  const manifestHash = repositoryContextManifestHash({
    dependencies,
    snapshotId: normalizedInput.snapshot.snapshotId,
    worktreeStateId: normalizedInput.worktreeStateId
  });
  const request = artifactInput(normalizedInput);
  const artifactIdentityHash = hashStableJson({ request, manifestHash, createdAt: normalizedInput.createdAt });
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
    warnings: compileWarnings(normalizedInput),
    unsafeReasons: unsafeReasons(normalizedInput),
    retrievalConfidence: normalizedInput.taskRetrieval?.confidence,
    createdAt: normalizedInput.createdAt,
    artifactHash
  });
}

function normalizeTaskRetrievalConfidence(
  input: CompileRepositoryContextArtifactInput
): CompileRepositoryContextArtifactInput {
  if (!input.taskRetrieval) return input;
  return {
    ...input,
    taskRetrieval: {
      ...input.taskRetrieval,
      confidence: classifyTaskRetrievalConfidence(input.taskRetrieval)
    }
  };
}

function artifactInput(input: CompileRepositoryContextArtifactInput): InMemoryContextRequest {
  return {
    taskId: input.taskId,
    sessionId: input.sessionId,
    repoId: input.snapshot.repoId,
    branch: input.snapshot.branch,
    commit: input.snapshot.commit,
    worktreeHash: input.snapshot.worktreeHash,
    environmentScope: environmentScope(input),
    packageRoot: stringScope(input, "packageRoot"),
    serviceRoot: stringScope(input, "serviceRoot"),
    featureFlagCount: numberScope(input, "featureFlagCount"),
    featureFlagScopeHash: stringScope(input, "featureFlagScopeHash"),
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
  warnings.push(...(input.currentScopeWarnings ?? []));
  warnings.push(...riskPolicy.warnings);
  warnings.push(...(input.taskRetrieval?.warnings ?? []));
  return warnings;
}

function unsafeReasons(input: CompileRepositoryContextArtifactInput): string[] {
  return [...evaluateRepositoryRiskPolicy(input).unsafeReasons];
}

function environmentScope(input: CompileRepositoryContextArtifactInput): EnvironmentScope | undefined {
  const value = input.currentScope?.environment;
  return isEnvironmentScope(value) ? value : undefined;
}

function stringScope(input: CompileRepositoryContextArtifactInput, key: string): string | undefined {
  const value = input.currentScope?.[key];
  return typeof value === "string" ? value : undefined;
}

function numberScope(input: CompileRepositoryContextArtifactInput, key: string): number | undefined {
  const value = input.currentScope?.[key];
  return typeof value === "number" ? value : undefined;
}

function isEnvironmentScope(value: unknown): value is EnvironmentScope {
  return (
    value === "local" ||
    value === "test" ||
    value === "ci" ||
    value === "staging" ||
    value === "production" ||
    value === "unknown"
  );
}
