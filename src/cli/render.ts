import type { DiagnosticStatus } from "../app/local-project/types.js";

export function renderProblems(label: string, values: readonly string[]): string[] {
  if (values.length === 0) return [];
  return ["", `${label}:`, ...values.map((value) => `  - ${value}`)];
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
    "  grape compile --task <text> Compile a task context pack",
    "  grape omitted --session <id> Inspect or restore omitted context",
    "  grape status                Inspect local project/bootstrap state",
    "  grape doctor                Run setup and privacy diagnostics",
    "  grape mcp --print-config    Print MCP client configuration",
    "  grape mcp --stdio           Serve MCP tools over stdio",
    "  grape help                  Show this help",
    "",
    "Options:",
    "  --repo <path>               Run against a repository path",
    "  --task-type <type>          Set task type for compile (default: analysis)",
    "  --risk <a,b>                Add compile risk overlays",
    "  --session <id>              Reuse a context session for diffing",
    "  --token <restore_token>     Restore an omitted context item",
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
