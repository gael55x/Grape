import type { ContextPackBudgetResult } from "../../core/compiler/index.js";
import type { DiagnosticCheck, LocalProjectStatus } from "./types.js";

export function recoveryGuidanceForStatus(status: LocalProjectStatus): readonly string[] {
  const guidance = new Set<string>();

  if (status.errors.some((error) => error.startsWith("git snapshot failed")) || !status.branch) {
    guidance.add("Run Grape from a Git worktree, or pass --repo <repo-root>.");
  }
  if (
    status.warnings.some((warning) => warning.includes(".grape")) ||
    status.errors.some((error) => error.startsWith("Grape config is repairable")) ||
    status.pendingMigrations.length > 0 ||
    !status.databaseExists
  ) {
    guidance.add("Run grape init --connect from the repository root to bootstrap or repair local state.");
  }
  if (status.errors.some((error) => error.startsWith("Grape config is repairable"))) {
    guidance.add("Grape will back up the invalid config before writing a fresh local config.");
  }
  if (status.errors.some((error) => error.startsWith("Grape config is unsupported"))) {
    guidance.add("Use a Grape version that supports this config, or inspect .grape/config.json before reinitializing.");
  }
  if (status.errors.some((error) => error.includes("config root path does not match"))) {
    guidance.add("Run with --repo pointing at the configured repository root, or reinitialize Grape in the intended repo.");
  }
  if (status.dirtyWorktree) {
    guidance.add("Commit or stash changes for branch-global context, or continue with worktree-scoped context.");
  }

  return [...guidance];
}

export function recoveryGuidanceForDoctor(
  status: LocalProjectStatus,
  checks: readonly DiagnosticCheck[]
): readonly string[] {
  const guidance = new Set(recoveryGuidanceForStatus(status));

  if (checks.some((check) => check.id === "node_runtime" && check.status === "fail")) {
    guidance.add("Use Node.js 22.5 or newer before running Grape.");
  }
  if (checks.some((check) => check.id === "privacy_local_exclude" && check.status !== "pass")) {
    guidance.add("Run grape init --connect to add .grape/ to local Git exclude rules.");
  }

  return [...guidance];
}

export function recoveryGuidanceForCompileResult(input: {
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
  readonly budget: ContextPackBudgetResult;
}): readonly string[] {
  const guidance = new Set<string>();

  if (input.unsafeReasons.includes("risk_overlay_missing_exact_context")) {
    guidance.add("Name the exact file or symbol in --task, or call MCP with files/symbols/tests seed refs.");
  }
  if (input.unsafeReasons.includes("token_budget_below_required_context")) {
    guidance.add("Increase --token-budget or omit it; Grape will not prune pinned, exact, or invalidation context.");
  }
  if (input.warnings.includes("dirty_worktree_context")) {
    guidance.add("Commit or stash changes for branch-global context, or continue with worktree-scoped context.");
  }
  if (input.budget.status === "over_budget") {
    guidance.add("Use grape artifacts --artifact <id> to inspect the pack before choosing a larger token budget.");
  }

  return [...guidance];
}

export function recoveryGuidanceForErrorMessage(message: string): readonly string[] {
  const guidance = new Set<string>();

  if (message.includes("session is locked")) {
    guidance.add("Run grape sessions to inspect the lock; wait for the active run or use a different --session.");
  }
  if (
    message.includes("config is missing") ||
    message.includes("Grape config is repairable") ||
    message.includes("Grape config is missing project identity") ||
    message.includes("Unexpected token") ||
    message.includes("Pending migrations")
  ) {
    guidance.add("Run grape init --connect from the repository root to bootstrap or repair local state.");
  }
  if (message.includes("unsupported Grape config schema version")) {
    guidance.add("Use a Grape version that supports this config, or inspect .grape/config.json before reinitializing.");
  }
  if (message.includes("config root path does not match")) {
    guidance.add("Run with --repo pointing at the configured repository root, or reinitialize Grape in the intended repo.");
  }
  if (message.includes("git snapshot failed") || message.includes("No readable Git repository")) {
    guidance.add("Run Grape from a Git worktree, or pass --repo <repo-root>.");
  }
  if (message.includes("secret") || message.includes("blocked redaction") || message.includes("privacy")) {
    guidance.add("Move secrets out of indexed files or add private paths to .grapeignore, then rerun grape doctor.");
  }
  if (message.includes("stale")) {
    guidance.add("Rerun grape compile for fresh context, or inspect stale entries with grape stale.");
  }

  return [...guidance];
}
