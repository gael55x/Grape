import { createHash } from "node:crypto";

import type { ContextScopeShape, EnvironmentScope } from "../../shared/index.js";
import { currentPackageRootFromSourceRefs, packageRootForSourceRef } from "./package-root.js";
import type { CurrentScopeInput } from "./scope-types.js";

export const defaultAllowedFeatureFlags = ["betaCheckout"] as const;

export interface CollectCurrentScopeInput {
  readonly repoId: string;
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
  readonly dirtyWorktree: boolean;
  readonly taskId: string;
  readonly sessionId: string;
  readonly environmentScope?: EnvironmentScope;
  readonly defaultEnvironmentScope?: EnvironmentScope;
  readonly featureFlags?: Readonly<Record<string, string | boolean>>;
  readonly allowedFeatureFlags?: readonly string[];
  readonly sourceRefs?: readonly string[];
}

export interface PublicCurrentScopeShape extends ContextScopeShape {
  readonly repoId: string;
  readonly branch: string;
  readonly commit: string;
  readonly worktreeHash: string;
  readonly dirtyWorktree: boolean;
  readonly taskId: string;
  readonly sessionId: string;
  readonly environment: EnvironmentScope;
  readonly packageRoot?: string;
  readonly serviceRoot?: string;
  readonly featureFlagCount: number;
  readonly featureFlagScopeHash?: string;
  readonly sourceRefs: readonly string[];
  readonly warnings: readonly string[];
}

export interface CollectedCurrentScope {
  readonly currentClaimScope: CurrentScopeInput;
  readonly claimEnvironment?: string;
  readonly artifactScope: ContextScopeShape;
  readonly publicScope: PublicCurrentScopeShape;
  readonly featureFlags?: Readonly<Record<string, string | boolean>>;
  readonly packageRoot?: string;
  readonly serviceRoot?: string;
  readonly warnings: readonly string[];
}

export function collectCurrentScope(input: CollectCurrentScopeInput): CollectedCurrentScope {
  const sourceRefs = [...new Set((input.sourceRefs ?? []).filter((ref) => ref.trim().length > 0))].sort();
  const packageRoot = currentPackageRootFromSourceRefs(sourceRefs);
  const serviceRoot = packageRoot;
  const normalizedFeatureFlags = normalizeFeatureFlags(
    input.featureFlags,
    input.allowedFeatureFlags ?? defaultAllowedFeatureFlags
  );
  const environmentScope = input.environmentScope ?? input.defaultEnvironmentScope ?? "local";
  const claimEnvironment = input.environmentScope === undefined || input.environmentScope === "unknown"
    ? undefined
    : input.environmentScope;
  const warnings = currentScopeWarnings({
    environmentScope: input.environmentScope,
    sourceRefs,
    packageRoot
  });
  const featureFlagCount = normalizedFeatureFlags?.count ?? 0;
  const featureFlagScopeHash = normalizedFeatureFlags?.scopeHash;
  const publicScope: PublicCurrentScopeShape = {
    repoId: input.repoId,
    branch: input.branch,
    commit: input.commit,
    worktreeHash: input.worktreeHash,
    dirtyWorktree: input.dirtyWorktree,
    taskId: input.taskId,
    sessionId: input.sessionId,
    environment: environmentScope,
    featureFlagCount,
    sourceRefs,
    warnings,
    ...(packageRoot ? { packageRoot, serviceRoot } : {}),
    ...(featureFlagScopeHash ? { featureFlagScopeHash } : {})
  };
  const artifactScope = omitUndefined({
    repoId: input.repoId,
    branch: input.branch,
    commit: input.commit,
    worktreeHash: input.worktreeHash,
    dirtyWorktree: input.dirtyWorktree,
    taskId: input.taskId,
    sessionId: input.sessionId,
    environment: environmentScope,
    packageRoot,
    serviceRoot,
    featureFlagCount,
    featureFlagScopeHash
  }) as ContextScopeShape;

  return {
    currentClaimScope: {
      branch: input.branch,
      commit: input.commit,
      worktreeHash: input.worktreeHash,
      environment: claimEnvironment,
      featureFlags: normalizedFeatureFlags?.flags,
      packageRoot,
      sessionId: input.sessionId
    },
    claimEnvironment,
    artifactScope,
    publicScope,
    featureFlags: normalizedFeatureFlags?.flags,
    packageRoot,
    serviceRoot,
    warnings
  };
}

function normalizeFeatureFlags(
  featureFlags: Readonly<Record<string, string | boolean>> | undefined,
  allowedFeatureFlags: readonly string[]
): { readonly flags: Readonly<Record<string, string | boolean>>; readonly count: number; readonly scopeHash: string } | undefined {
  if (!featureFlags) return undefined;
  const allowed = new Set(allowedFeatureFlags);
  const entries = Object.entries(featureFlags).sort(([left], [right]) => left.localeCompare(right));
  const normalized: Record<string, string | boolean> = {};

  for (const [name, value] of entries) {
    if (!safeFeatureFlagName(name)) {
      throw new Error("feature flags must use safe names and optional values");
    }
    if (!allowed.has(name)) {
      throw new Error("feature flags must be allowlisted before use as current scope");
    }
    if (typeof value !== "boolean" && !safeFeatureFlagValue(value)) {
      throw new Error("feature flags must use safe names and optional values");
    }
    normalized[name] = value;
  }

  return {
    flags: normalized,
    count: entries.length,
    scopeHash: hashStableJson(normalized)
  };
}

function currentScopeWarnings(input: {
  readonly environmentScope?: EnvironmentScope;
  readonly sourceRefs: readonly string[];
  readonly packageRoot?: string;
}): string[] {
  const warnings: string[] = [];
  if (input.environmentScope === "unknown") warnings.push("current_scope_environment_unknown");
  if (input.sourceRefs.length > 0 && !input.packageRoot && uniquePackageRoots(input.sourceRefs).length > 1) {
    warnings.push("current_scope_package_root_ambiguous");
  }
  return warnings;
}

function uniquePackageRoots(sourceRefs: readonly string[]): string[] {
  return [...new Set(sourceRefs.map(packageRootForSourceRef).filter((root): root is string => Boolean(root)))].sort();
}

function safeFeatureFlagName(value: string): boolean {
  return /^[A-Za-z0-9_.:-]{1,80}$/.test(value);
}

function safeFeatureFlagValue(value: string): boolean {
  return value.trim().length > 0 && value.length <= 120 && !/[\0\r\n\t]/.test(value);
}

function hashStableJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function omitUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
