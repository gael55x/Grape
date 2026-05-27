import type { DiagnosticStatus } from "../app/local-project/types.js";

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

export function helpText(): string {
  return [
    "Grape - local-first context compiler for AI coding agents",
    "",
    "Usage:",
    "  grape init --connect        Initialize local .grape state and show MCP guidance",
    "  grape sync                  Refresh local snapshot, evidence, and file index",
    "  grape compile --task <text> Compile a task context pack",
    "  grape diff-context --task <text> Compile and diff a task context pack",
    "  grape artifacts             Inspect compiled context artifacts",
    "  grape bench --fixture <name> Run scripted V1 fixture benchmarks",
    "  grape sessions              Inspect context sessions and diff ledgers",
    "  grape stale                 Inspect stale-context invalidations",
    "  grape claims --active       Inspect current-valid durable claims",
    "  grape conflicts             Inspect recorded claim conflict edges",
    "  grape proofs               Inspect persisted proof rows",
    "  grape omitted --session <id> Inspect or restore omitted context",
    "  grape status                Inspect local project/bootstrap state",
    "  grape doctor                Run setup and privacy diagnostics",
    "  grape doctor --privacy      Run privacy-focused diagnostics",
    "  grape mcp --print-config    Print MCP client configuration",
    "  grape mcp --stdio           Serve MCP tools over stdio",
    "  grape help                  Show this help",
    "",
    "Options:",
    "  --repo <path>               Run against a repository path",
    "  --task-type <type>          Set task type for compile (default: analysis)",
    "  --risk <a,b>                Add compile risk overlays",
    "  --session <id>              Reuse a context session for diffing",
    "  --reset-session             Force full resend for a reused compile session",
    "  --token-budget <tokens>     Evaluate whether compile output fits a token budget",
    "  --token <restore_token>     Restore an omitted context item",
    "  --artifact <id>             Inspect one context artifact",
    "  --proof <id>                Inspect one persisted proof row",
    "  --source <id>               Filter proof rows by source id",
    "  --fixture <name>            Run a named benchmark fixture",
    "  --fixture-path <path>       Use an explicit benchmark fixture path",
    "  --keep-workspace            Keep benchmark temp workspace for debugging",
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

export function write(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function writeJson(value: unknown): void {
  write(JSON.stringify(value, null, 2));
}

export function writeError(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
