import path from "node:path";

import { compileLocalContext } from "../app/local-project/index.js";
import type { CompileLocalContextResult } from "../app/local-project/index.js";
import type {
  AgentContextArtifactRef,
  AgentContextGraphCut,
  AgentContextPackItemShape,
  ContextPackItemShape,
  DiffState,
  GrapeGetContextOutputMode,
  RiskOverlay,
  TaskType
} from "../shared/index.js";
import {
  buildAgentContextArtifactRef,
  buildAgentContextGraphCut,
  compactAgentContextPackItems,
  grapeGetContextOutputModes,
  renderAgentContextPackMarkdown,
  taskTypes
} from "../shared/index.js";
import { resolveMcpSessionId } from "./session.js";

export interface GrapeGetContextToolInput {
  readonly query: string;
  readonly taskType?: Exclude<TaskType, "bootstrap">;
  readonly files?: readonly string[];
  readonly symbols?: readonly string[];
  readonly tests?: readonly string[];
  readonly environmentScope?: "local" | "test" | "ci" | "staging" | "production" | "unknown";
  readonly featureFlags?: Readonly<Record<string, string | boolean>>;
  readonly tokenBudget?: number;
  readonly sessionId?: string;
  readonly agentName?: string;
  readonly agentSessionId?: string;
  readonly resetSession?: boolean;
  readonly outputMode?: GrapeGetContextOutputMode;
}

export interface GrapeGetContextToolOutput {
  readonly artifactId: string;
  readonly artifactHash: string;
  readonly dependencyManifestHash: string;
  readonly sessionId: string;
  readonly branch: string;
  readonly headCommit: string;
  readonly dirtyWorktree: boolean;
  readonly currentScope: CompileLocalContextResult["currentScope"];
  readonly taskType: TaskType;
  readonly riskOverlays: readonly RiskOverlay[];
  readonly compileMode: "safe_minimum" | "partial_with_risk" | "broad_context_required" | "cannot_compile_safely";
  readonly outputMode: GrapeGetContextOutputMode;
  readonly artifactRef: AgentContextArtifactRef;
  readonly agentGraph: AgentContextGraphCut;
  readonly contextArtifact?: CompileLocalContextResult["contextArtifact"];
  readonly contextPackItems: readonly (AgentContextPackItemShape | ContextPackItemShape)[];
  readonly contextPackMarkdown: string;
  readonly diffSummary: {
    readonly newItems: number;
    readonly changedItems: number;
    readonly pinnedItems: number;
    readonly omittedItems: number;
    readonly invalidatedItems: number;
    readonly restoreAvailableItems: number;
  };
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
  readonly recoveryGuidance: readonly string[];
  readonly budget: CompileLocalContextResult["budget"];
  readonly sessionResetId?: string;
  readonly restoreAvailable: boolean;
  readonly artifactFiles: {
    readonly json: string;
    readonly markdown: string;
  };
}

export function runGrapeGetContextTool(input: unknown, rootPath: string): GrapeGetContextToolOutput {
  const parsed = parseInput(input);
  const sessionId = resolveMcpSessionId(parsed);
  const result = compileLocalContext({
    rootPath,
    task: parsed.query,
    taskType: parsed.taskType,
    environmentScope: parsed.environmentScope,
    featureFlags: parsed.featureFlags,
    riskSeedRefs: [...(parsed.files ?? []), ...(parsed.symbols ?? []), ...(parsed.tests ?? [])],
    seedFiles: parsed.files,
    seedSymbols: parsed.symbols,
    seedTests: parsed.tests,
    tokenBudget: parsed.tokenBudget,
    sessionId,
    resetSession: parsed.resetSession
  });

  const warningSet = new Set([...result.warnings, ...unsupportedInputWarnings(parsed)]);
  const warnings = [...warningSet];
  const outputMode = parsed.outputMode ?? "agent_pack";
  const compactContextPackItems = compactAgentContextPackItems(result.contextPackItems);
  const contextPackItems = outputMode === "full" ? result.contextPackItems : compactContextPackItems;
  const diffSummary = summarizeDiff(contextPackItems);
  const artifactFiles = {
    json: relativeArtifactPath(result.rootPath, result.artifactJsonPath),
    markdown: relativeArtifactPath(result.rootPath, result.artifactMarkdownPath)
  };
  const artifactRef = buildAgentContextArtifactRef({
    artifactId: result.artifactId,
    artifactHash: result.artifactHash,
    dependencyManifestHash: result.dependencyManifestHash,
    artifactFiles
  });
  const output: GrapeGetContextToolOutput = {
    artifactId: result.artifactId,
    artifactHash: result.artifactHash,
    dependencyManifestHash: result.dependencyManifestHash,
    sessionId: result.sessionId,
    branch: result.branch,
    headCommit: result.headCommit,
    dirtyWorktree: result.dirtyWorktree,
    currentScope: result.currentScope,
    taskType: taskTypeFromResult(parsed.taskType),
    riskOverlays: result.riskOverlays,
    compileMode: compileModeFor(result, warnings),
    outputMode,
    artifactRef,
    agentGraph: buildAgentContextGraphCut({
      artifactId: result.artifactId,
      artifactHash: result.artifactHash,
      dependencyManifestHash: result.dependencyManifestHash,
      contextPackItems
    }),
    contextPackItems,
    contextPackMarkdown: renderAgentContextPackMarkdown({
      artifactId: result.artifactId,
      contextArtifact: result.contextArtifact,
      contextPackItems,
      packItemContentMode: outputMode === "full" ? "full" : "preview",
      diffSummary,
      warnings,
      unsafeReasons: result.unsafeReasons,
      budget: result.budget
    }),
    diffSummary,
    warnings,
    unsafeReasons: result.unsafeReasons,
    recoveryGuidance: result.recoveryGuidance,
    budget: result.budget,
    sessionResetId: result.sessionResetId,
    restoreAvailable: result.contextPackItems.some((item) => item.state === "RESTORE_AVAILABLE" || item.restoreId),
    artifactFiles
  };

  if (outputMode === "full") {
    return { ...output, contextArtifact: result.contextArtifact };
  }

  return output;
}

function parseInput(input: unknown): GrapeGetContextToolInput {
  if (!isRecord(input)) throw new Error("grape_get_context arguments must be an object");
  assertAllowedFields(input, [
    "query",
    "taskType",
    "files",
    "symbols",
    "tests",
    "environmentScope",
    "featureFlags",
    "tokenBudget",
    "sessionId",
    "agentName",
    "agentSessionId",
    "resetSession",
    "outputMode"
  ]);
  const query = requiredString(input.query, "query");
  return {
    query,
    taskType: optionalTaskType(input.taskType),
    files: optionalStringArray(input.files, "files"),
    symbols: optionalStringArray(input.symbols, "symbols"),
    tests: optionalStringArray(input.tests, "tests"),
    environmentScope: optionalEnvironmentScope(input.environmentScope),
    featureFlags: optionalFeatureFlags(input.featureFlags),
    tokenBudget: optionalPositiveInteger(input.tokenBudget, "tokenBudget"),
    sessionId: optionalString(input.sessionId, "sessionId"),
    agentName: optionalString(input.agentName, "agentName"),
    agentSessionId: optionalString(input.agentSessionId, "agentSessionId"),
    resetSession: optionalBoolean(input.resetSession, "resetSession"),
    outputMode: optionalOutputMode(input.outputMode)
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value;
}

function optionalPositiveInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${field} must be a boolean`);
  return value;
}

function optionalStringArray(value: unknown, field: string): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${field} must be an array of non-empty strings`);
  }
  return value;
}

function optionalTaskType(value: unknown): Exclude<TaskType, "bootstrap"> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value === "bootstrap" || !taskTypes.includes(value as TaskType)) {
    throw new Error("taskType must be a supported non-bootstrap task type");
  }
  return value as Exclude<TaskType, "bootstrap">;
}

function optionalOutputMode(value: unknown): GrapeGetContextOutputMode | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !grapeGetContextOutputModes.includes(value as GrapeGetContextOutputMode)) {
    throw new Error("outputMode must be agent_pack or full");
  }
  return value as GrapeGetContextOutputMode;
}

function optionalEnvironmentScope(
  value: unknown
): "local" | "test" | "ci" | "staging" | "production" | "unknown" | undefined {
  if (value === undefined) return undefined;
  const allowed = ["local", "test", "ci", "staging", "production", "unknown"] as const;
  if (typeof value !== "string" || !allowed.includes(value as (typeof allowed)[number])) {
    throw new Error("environmentScope must be local, test, ci, staging, production, or unknown");
  }
  return value as (typeof allowed)[number];
}

function optionalFeatureFlags(value: unknown): Readonly<Record<string, string | boolean>> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || Object.keys(value).length === 0) {
    throw new Error("featureFlags must be a non-empty object");
  }
  const flags: Record<string, string | boolean> = {};
  for (const [key, flagValue] of Object.entries(value)) {
    if (!safeFeatureFlagName(key)) throw new Error("featureFlags keys must use safe feature flag names");
    if (typeof flagValue === "boolean") {
      flags[key] = flagValue;
      continue;
    }
    if (
      typeof flagValue !== "string" ||
      flagValue.trim() === "" ||
      /[\0\r\n\t]/.test(flagValue) ||
      flagValue.length > 120
    ) {
      throw new Error("featureFlags values must be booleans or non-empty safe strings");
    }
    flags[key] = flagValue;
  }
  return flags;
}

function safeFeatureFlagName(value: string): boolean {
  return /^[A-Za-z0-9_.:-]{1,80}$/.test(value);
}

function taskTypeFromResult(inputTaskType: GrapeGetContextToolInput["taskType"]): TaskType {
  return inputTaskType ?? "analysis";
}

function compileModeFor(
  result: CompileLocalContextResult,
  warnings: readonly string[]
): GrapeGetContextToolOutput["compileMode"] {
  if (result.unsafeReasons.length > 0) return "cannot_compile_safely";
  if (warnings.length > 0) return "partial_with_risk";
  return "safe_minimum";
}

function summarizeDiff(
  items: readonly Pick<ContextPackItemShape | AgentContextPackItemShape, "state">[]
): GrapeGetContextToolOutput["diffSummary"] {
  return {
    newItems: countState(items, "NEW"),
    changedItems: countState(items, "CHANGED"),
    pinnedItems: countState(items, "PINNED"),
    omittedItems: countState(items, "OMIT_UNCHANGED"),
    invalidatedItems: countState(items, "INVALIDATE_PREVIOUS"),
    restoreAvailableItems: countState(items, "RESTORE_AVAILABLE")
  };
}

function countState(
  items: readonly Pick<ContextPackItemShape | AgentContextPackItemShape, "state">[],
  state: DiffState
): number {
  return items.filter((item) => item.state === state).length;
}

function unsupportedInputWarnings(input: GrapeGetContextToolInput): string[] {
  const warnings: string[] = [];
  if (input.agentName || input.agentSessionId) warnings.push("mcp_agent_identity_not_persisted_in_context_compile");
  return warnings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertAllowedFields(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new Error(`unsupported grape_get_context argument: ${key}`);
  }
}

function relativeArtifactPath(rootPath: string, artifactPath: string): string {
  const relative = path.relative(rootPath, artifactPath);
  return relative.startsWith("..") || path.isAbsolute(relative) ? path.basename(artifactPath) : relative;
}
