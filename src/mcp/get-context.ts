import path from "node:path";
import { readFileSync } from "node:fs";

import { compileLocalContext } from "../app/local-project/index.js";
import type { CompileLocalContextResult } from "../app/local-project/index.js";
import type { DiffState, InMemoryContextPackItemShape, RiskOverlay, TaskType } from "../shared/index.js";
import { taskTypes } from "../shared/index.js";
import { resolveMcpSessionId } from "./session.js";

export interface GrapeGetContextToolInput {
  readonly query: string;
  readonly taskType?: Exclude<TaskType, "bootstrap">;
  readonly files?: readonly string[];
  readonly symbols?: readonly string[];
  readonly tests?: readonly string[];
  readonly environmentScope?: "local" | "test" | "ci" | "staging" | "production" | "unknown";
  readonly tokenBudget?: number;
  readonly sessionId?: string;
  readonly agentName?: string;
  readonly agentSessionId?: string;
  readonly resetSession?: boolean;
}

export interface GrapeGetContextToolOutput {
  readonly artifactId: string;
  readonly artifactHash: string;
  readonly dependencyManifestHash: string;
  readonly sessionId: string;
  readonly branch: string;
  readonly headCommit: string;
  readonly dirtyWorktree: boolean;
  readonly taskType: TaskType;
  readonly riskOverlays: readonly RiskOverlay[];
  readonly compileMode: "safe_minimum" | "partial_with_risk" | "broad_context_required" | "cannot_compile_safely";
  readonly contextPackItems: readonly InMemoryContextPackItemShape[];
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
    riskSeedRefs: [...(parsed.files ?? []), ...(parsed.symbols ?? []), ...(parsed.tests ?? [])],
    sessionId,
    resetSession: parsed.resetSession
  });

  const warningSet = new Set([...result.warnings, ...unsupportedInputWarnings(parsed)]);
  const warnings = [...warningSet];
  return {
    artifactId: result.artifactId,
    artifactHash: result.artifactHash,
    dependencyManifestHash: result.dependencyManifestHash,
    sessionId: result.sessionId,
    branch: result.branch,
    headCommit: result.headCommit,
    dirtyWorktree: result.dirtyWorktree,
    taskType: taskTypeFromResult(parsed.taskType),
    riskOverlays: result.riskOverlays,
    compileMode: compileModeFor(result, warnings),
    contextPackItems: result.contextPackItems,
    contextPackMarkdown: readFileSync(result.artifactMarkdownPath, "utf8"),
    diffSummary: summarizeDiff(result.contextPackItems),
    warnings,
    unsafeReasons: result.unsafeReasons,
    sessionResetId: result.sessionResetId,
    restoreAvailable: result.contextPackItems.some((item) => item.state === "RESTORE_AVAILABLE" || item.restoreToken),
    artifactFiles: {
      json: relativeArtifactPath(result.rootPath, result.artifactJsonPath),
      markdown: relativeArtifactPath(result.rootPath, result.artifactMarkdownPath)
    }
  };
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
    "tokenBudget",
    "sessionId",
    "agentName",
    "agentSessionId",
    "resetSession"
  ]);
  const query = requiredString(input.query, "query");
  return {
    query,
    taskType: optionalTaskType(input.taskType),
    files: optionalStringArray(input.files, "files"),
    symbols: optionalStringArray(input.symbols, "symbols"),
    tests: optionalStringArray(input.tests, "tests"),
    environmentScope: optionalEnvironmentScope(input.environmentScope),
    tokenBudget: optionalNumber(input.tokenBudget, "tokenBudget"),
    sessionId: optionalString(input.sessionId, "sessionId"),
    agentName: optionalString(input.agentName, "agentName"),
    agentSessionId: optionalString(input.agentSessionId, "agentSessionId"),
    resetSession: optionalBoolean(input.resetSession, "resetSession")
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

function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field} must be a finite number`);
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

function summarizeDiff(items: readonly InMemoryContextPackItemShape[]): GrapeGetContextToolOutput["diffSummary"] {
  return {
    newItems: countState(items, "NEW"),
    changedItems: countState(items, "CHANGED"),
    pinnedItems: countState(items, "PINNED"),
    omittedItems: countState(items, "OMIT_UNCHANGED"),
    invalidatedItems: countState(items, "INVALIDATE_PREVIOUS"),
    restoreAvailableItems: countState(items, "RESTORE_AVAILABLE")
  };
}

function countState(items: readonly InMemoryContextPackItemShape[], state: DiffState): number {
  return items.filter((item) => item.state === state).length;
}

function unsupportedInputWarnings(input: GrapeGetContextToolInput): string[] {
  const warnings: string[] = [];
  if (input.files && input.files.length > 0) warnings.push("mcp_seed_files_not_used_in_scaffold_compile");
  if (input.symbols && input.symbols.length > 0) warnings.push("mcp_seed_symbols_not_used_in_scaffold_compile");
  if (input.tests && input.tests.length > 0) warnings.push("mcp_seed_tests_not_used_in_scaffold_compile");
  if (input.tokenBudget !== undefined) warnings.push("mcp_token_budget_not_enforced_in_scaffold_compile");
  if (input.environmentScope && input.environmentScope !== "local") {
    warnings.push("mcp_environment_scope_not_applied_in_scaffold_compile");
  }
  if (input.agentName || input.agentSessionId) warnings.push("mcp_agent_identity_not_persisted_in_scaffold_compile");
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
