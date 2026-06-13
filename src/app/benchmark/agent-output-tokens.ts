import path from "node:path";

import type { CompileLocalContextResult } from "../local-project/types.js";
import {
  buildAgentContextArtifactRef,
  buildAgentContextGraphCut,
  compactAgentContextPackItems
} from "../../shared/index.js";
import type { ContextPackItemShape, DiffState } from "../../shared/index.js";

export interface BenchmarkAgentOutputTokenMetric {
  readonly serializedAgentOutputTokens: number;
  readonly serializedAgentStructuredTokens: number;
  readonly serializedAgentTextTokens: number;
  readonly agentOutputOverheadPercent: number;
}

export function buildBenchmarkAgentOutputTokenMetric(
  result: CompileLocalContextResult
): BenchmarkAgentOutputTokenMetric {
  const contextPackItems = compactAgentContextPackItems(result.contextPackItems);
  const artifactFiles = {
    json: relativeArtifactPath(result.rootPath, result.artifactJsonPath),
    markdown: relativeArtifactPath(result.rootPath, result.artifactMarkdownPath)
  };
  const diffSummary = summarizeDiff(contextPackItems);
  const structuredContent = {
    artifactId: result.artifactId,
    artifactHash: result.artifactHash,
    dependencyManifestHash: result.dependencyManifestHash,
    sessionId: result.sessionId,
    branch: result.branch,
    headCommit: result.headCommit,
    dirtyWorktree: result.dirtyWorktree,
    taskType: result.contextArtifact.taskType,
    riskOverlays: result.riskOverlays,
    compileMode: compileModeFor(result),
    outputMode: "agent_pack",
    artifactRef: buildAgentContextArtifactRef({
      artifactId: result.artifactId,
      artifactHash: result.artifactHash,
      dependencyManifestHash: result.dependencyManifestHash,
      artifactFiles
    }),
    agentGraph: buildAgentContextGraphCut({
      artifactId: result.artifactId,
      artifactHash: result.artifactHash,
      dependencyManifestHash: result.dependencyManifestHash,
      contextPackItems
    }),
    contextPackItems,
    diffSummary,
    warnings: result.warnings,
    unsafeReasons: result.unsafeReasons,
    recoveryGuidance: result.recoveryGuidance,
    budget: result.budget,
    sessionResetId: result.sessionResetId,
    restoreAvailable: result.contextPackItems.some((item) => item.state === "RESTORE_AVAILABLE" || item.restoreId),
    artifactFiles
  };
  const text = [
    "grape_get_context:",
    "mode=agent_pack",
    `compileMode=${structuredContent.compileMode}`,
    `session=${result.sessionId}`,
    `artifact=${result.artifactId}`,
    `packItems=${result.contextPackItems.length}`,
    `restore=${structuredContent.restoreAvailable ? "yes" : "no"}`,
    "see structuredContent"
  ].join(" ");
  const mcpResult = {
    content: [{ type: "text", text }],
    structuredContent,
    isError: result.unsafeReasons.length > 0
  };
  const serializedAgentTextTokens = estimateSerializedTokens(mcpResult.content);
  const serializedAgentStructuredTokens = estimateSerializedTokens(mcpResult.structuredContent);
  const serializedAgentOutputTokens = estimateSerializedTokens(mcpResult);

  return {
    serializedAgentOutputTokens,
    serializedAgentStructuredTokens,
    serializedAgentTextTokens,
    agentOutputOverheadPercent: firstTurnAgentOutputOverheadPercent(
      result.tokenMetric.naiveTokens,
      serializedAgentOutputTokens
    )
  };
}

function summarizeDiff(items: readonly Pick<ContextPackItemShape, "state">[]): {
  readonly newItems: number;
  readonly changedItems: number;
  readonly pinnedItems: number;
  readonly omittedItems: number;
  readonly invalidatedItems: number;
  readonly restoreAvailableItems: number;
} {
  return {
    newItems: countState(items, "NEW"),
    changedItems: countState(items, "CHANGED"),
    pinnedItems: countState(items, "PINNED"),
    omittedItems: countState(items, "OMIT_UNCHANGED"),
    invalidatedItems: countState(items, "INVALIDATE_PREVIOUS"),
    restoreAvailableItems: countState(items, "RESTORE_AVAILABLE")
  };
}

function countState(items: readonly Pick<ContextPackItemShape, "state">[], state: DiffState): number {
  return items.filter((item) => item.state === state).length;
}

function compileModeFor(
  result: CompileLocalContextResult
): "safe_minimum" | "partial_with_risk" | "broad_context_required" | "cannot_compile_safely" {
  if (result.unsafeReasons.length > 0) return "cannot_compile_safely";
  if (result.warnings.length > 0) return "partial_with_risk";
  return "safe_minimum";
}

function relativeArtifactPath(rootPath: string, artifactPath: string): string {
  const relative = path.relative(rootPath, artifactPath);
  return relative.startsWith("..") || path.isAbsolute(relative) ? path.basename(artifactPath) : relative;
}

function firstTurnAgentOutputOverheadPercent(naiveTokens: number, serializedAgentOutputTokens: number): number {
  if (naiveTokens <= 0) return 0;
  return roundPercent(Math.max(0, ((serializedAgentOutputTokens - naiveTokens) / naiveTokens) * 100));
}

function estimateSerializedTokens(value: unknown): number {
  return Math.ceil(Buffer.byteLength(JSON.stringify(value), "utf8") / 4);
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}
