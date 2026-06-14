import type { DiagnosticStatus } from "../app/local-project/types.js";
import {
  sanitizePublicOutput,
  sanitizePublicText,
  type PublicOutputSanitizerOptions
} from "../shared/index.js";

export function renderProblems(label: string, values: readonly string[]): string[] {
  if (values.length === 0) return [];
  return ["", `${label}:`, ...values.map((value) => `  - ${value}`)];
}

export function renderReasonCounts(counts: Readonly<Record<string, number>>): string {
  const activeCounts = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}=${count}`);
  return activeCounts.length === 0 ? "none" : activeCounts.join(", ");
}

export function statusLabel(status: DiagnosticStatus): string {
  switch (status) {
    case "pass":
      return "PASS";
    case "warn":
      return "WARN";
    case "fail":
      return "FAIL";
  }
}

const STATUS_WARNING_LABELS: Readonly<Record<string, string>> = {
  stale_context_invalidations_present:
    "Prior sent context was invalidated; rerun compile or run grape stale.",
  dirty_worktree_context:
    "Uncommitted changes may not be fully reflected; commit/stash or continue with worktree-scoped context."
};

export function humanizeStatusWarning(code: string): string {
  return STATUS_WARNING_LABELS[code] ?? code;
}

export function formatCommandFailure(command: string, error: unknown, guidance?: readonly string[]): string {
  const message = errorMessage(error);
  if (!guidance || guidance.length === 0) return `grape ${command} failed: ${message}`;
  return [`grape ${command} failed: ${message}`, "", "Recovery:", ...guidance.map((line) => `  ${line}`)].join("\n");
}

export function helpText(): string {
  return [
    "Grape - local-first context compiler for AI coding agents",
    "",
    "Usage:",
    "  grape init                  Initialize local .grape state without MCP guidance",
    "  grape init --connect        Initialize local .grape state and show MCP guidance",
    "  grape sync                  Refresh local snapshot, evidence, and file index",
    "  grape compile --task <text> Compile a task context pack",
    "  grape diff-context --task <text> Compile and diff a task context pack",
    "  grape diff-context --explain   Show per-item diff reasons for the pack",
    "  grape run --session <id> -- <cmd...> Record a Grape-observed command run",
    "  grape test --session <id> -- <cmd...> Record a Grape-observed test run",
    "  grape artifacts             Inspect compiled context artifacts",
    "  grape bench --fixture <name> Run scripted fixture benchmarks",
    "  grape sessions              Inspect context sessions and diff ledgers",
    "  grape stale                 Inspect stale-context invalidations",
    "  grape claims --active       Inspect current-valid durable claims",
    "  grape conflicts             Inspect open claim conflict edges",
    "  grape conflicts --resolve <edge> --as coexists_with",
    "                              Mark a conflict as manually resolved",
    "  grape proofs               Inspect persisted proof rows",
    "  grape omitted --session <id> Inspect or restore omitted context",
    "  grape status                Inspect local project/bootstrap state",
    "  grape doctor                Run setup and privacy diagnostics",
    "  grape doctor --privacy      Run privacy-focused diagnostics",
    "  grape mcp --print-config    Print MCP client configuration",
    "  grape mcp --stdio           Serve MCP tools over stdio",
    "  grape help                  Show this help",
    "",
    "Workflow: init --connect -> status/doctor -> compile --task -> run/test --session",
    "",
    "Options:",
    "  --repo <path>               Run against a repository path",
    "  --task-type <type>          Set task type for compile (default: analysis)",
    "  --environment-scope <env>   Scope compile to local, test, ci, staging, production, or unknown",
    "  --feature-flags <flags>     Scope compile to comma-separated feature flag name or name=value entries",
    "  --risk <a,b>                Add compile risk overlays",
    "  --session <id>              Reuse a context session for diffing",
    "  --reset-session             Force full resend for a reused compile session",
    "  --token-budget <tokens>     Evaluate whether compile output fits a token budget",
    "  --token <restore_token>     Restore an omitted context item",
    "  --artifact <id>             Inspect one context artifact",
    "  --proof <id>                Inspect one persisted proof row",
    "  --resolve <edge_id>         Resolve one open conflict edge",
    "  --as <resolution>           Conflict resolution: coexists_with or variant_of",
    "  --source <id>               Filter proof rows by source id",
    "  --fixture <name>            Run a named benchmark fixture",
    "  --fixture-path <path>       Use an explicit benchmark fixture path",
    "  --keep-workspace            Keep benchmark temp workspace for debugging",
    "  --test-framework <name>     Label a Grape-observed test run",
    "  --json                      Emit machine-readable JSON"
  ].join("\n");
}

export function initHelpText(): string {
  return [
    "Usage:",
    "  grape init --connect [--repo <path>] [--json]",
    "",
    "Creates local .grape state, applies SQLite migrations, captures the first Git snapshot,",
    "and prints MCP connection guidance."
  ].join("\n");
}

export function write(message: string, options?: PublicOutputSanitizerOptions): void {
  process.stdout.write(`${sanitizePublicText(message, options)}\n`);
}

export function writeJson(value: unknown, options?: PublicOutputSanitizerOptions): void {
  const outputOptions = optionsWithValueRootAlias(value, options);
  write(JSON.stringify(sanitizePublicOutput(value, outputOptions), null, 2), outputOptions);
}

export function writeError(message: string, options?: PublicOutputSanitizerOptions): void {
  process.stderr.write(`${sanitizePublicText(message, options)}\n`);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function repoOutputOptions(
  rootPath: string,
  rootPathAliases: readonly string[] = []
): PublicOutputSanitizerOptions {
  return { rootPath, rootPathAliases };
}

function optionsWithValueRootAlias(
  value: unknown,
  options: PublicOutputSanitizerOptions = {}
): PublicOutputSanitizerOptions {
  if (!isRecord(value) || typeof value.rootPath !== "string") return options;
  return {
    ...options,
    rootPathAliases: [...(options.rootPathAliases ?? []), value.rootPath]
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
