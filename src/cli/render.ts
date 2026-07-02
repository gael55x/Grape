import type { DiagnosticStatus } from "../app/local-project/types.js";
import {
  sanitizePublicOutput,
  sanitizePublicText,
  type PublicOutputSanitizerOptions
} from "../shared/index.js";
import { styleHumanOutput } from "./style.js";

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
  return humanizeCliWarning(STATUS_WARNING_LABELS[code] ?? code);
}

export function humanizeCliWarning(code: string): string {
  if (code === "repository_artifact_uses_lightweight_index") {
    return "Using lightweight source indexing. Graph coverage may be partial.";
  }
  if (code.startsWith("current_valid_Unknown scope is not current-valid:")) {
    return "Some claims were excluded because their scope could not be proven current. Use grape claims --active --json for details.";
  }
  return code;
}

export function formatCommandFailure(command: string, error: unknown, guidance?: readonly string[]): string {
  const message = humanizeCommandErrorMessage(errorMessage(error));
  if (!guidance || guidance.length === 0) return `grape ${command} failed: ${message}`;
  return [`grape ${command} failed: ${message}`, "", "Recovery:", ...guidance.map((line) => `  ${line}`)].join("\n");
}

export function humanizeCommandErrorMessage(message: string): string {
  if (isNotGitRepositoryMessage(message)) {
    return "No Git repository found.";
  }
  if (isEmptyGitRepositoryMessage(message)) {
    return "This Git repository has no commits yet.";
  }
  return message;
}

function isNotGitRepositoryMessage(message: string): boolean {
  return message.includes("not a git repository") || message.includes("not in a git directory");
}

function isEmptyGitRepositoryMessage(message: string): boolean {
  return (
    message.includes("ambiguous argument 'HEAD'") ||
    message.includes("Needed a single revision") ||
    message.includes("does not have any commits yet")
  );
}

export function helpText(): string {
  return [
    "Grape - session-safe context transport for AI coding agents",
    "",
    "Usage:",
    "  grape --version             Print the installed package version",
    "  grape version               Print the installed package version",
    "  grape init                  Initialize local .grape state without MCP guidance",
    "  grape init --connect        Initialize local .grape state and show MCP guidance",
    "  grape mcp --print-config    Print MCP client configuration",
    "  grape mcp --install --client cursor",
    "                              Write project-local Cursor MCP config",
    "  grape mcp --install --client claude",
    "                              Write Claude Desktop MCP config",
    "  grape mcp --install --client codex",
    "                              Write project-local Codex MCP config",
    "  grape mcp --install --client generic",
    "                              Print or merge generic JSON MCP config",
    "  grape mcp --print-agents-snippet",
    "                              Print AGENTS.md setup guidance",
    "  grape mcp --stdio           Serve MCP tools over stdio",
    "  grape status                Inspect local project/bootstrap state",
    "  grape doctor                Run setup and privacy diagnostics",
    "  grape doctor --privacy      Run privacy-focused diagnostics",
    "  grape sync                  Refresh local snapshot, evidence, and file index",
    "  grape compact               Preview local retention cleanup",
    "  grape compact --confirm     Apply eligible local retention cleanup",
    "  grape export                Export a local data inventory without raw bodies",
    "  grape purge                 Preview deletion of repo-local .grape state",
    "  grape purge --confirm       Delete repo-local .grape state after safety checks",
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
    "  grape help                  Show this help",
    "",
    "Primary workflow:",
    "  grape init --connect",
    "  grape mcp --install --client cursor",
    "  grape mcp --install --client claude",
    "  grape mcp --install --client codex",
    "  grape mcp --install --client generic",
    "  grape mcp --print-agents-snippet",
    "  Use your MCP-capable agent normally. The agent should call grape_get_context each turn with a stable sessionId.",
    "",
    "Manual MCP fallback:",
    "  grape mcp --print-config",
    "",
    "CLI fallback:",
    "  grape compile --task <text> --session <id>",
    "  grape diff-context --task <text> --session <id> --explain",
    "  grape run --session <id> -- <cmd...>",
    "  grape test --session <id> -- <cmd...>",
    "",
    "Run grape <command> --help for command-specific usage.",
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
    "  --client <name>             MCP install client: cursor, claude, codex, or generic",
    "  --config-path <path>        Explicit MCP config file path for install",
    "  --dry-run                   Preview MCP client config writes without changing files",
    "  --confirm                   Apply a destructive local maintenance command",
    "  --force                     Replace a conflicting existing Grape MCP server entry",
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

export function commandHelpText(command: string): string | undefined {
  return COMMAND_HELP[command];
}

const COMMAND_HELP: Readonly<Record<string, string>> = {
  init: [
    "Usage:",
    "  grape init --connect [--repo <path>] [--json]",
    "  grape init [--repo <path>] [--json]",
    "",
    "Creates or repairs local .grape state, applies SQLite migrations, captures the first Git snapshot, and prints MCP setup guidance when --connect is present.",
    "",
    "Recovery:",
    "  Run from a Git worktree with at least one commit, or pass --repo <repo-root>."
  ].join("\n"),
  status: [
    "Usage:",
    "  grape status [--repo <path>] [--json]",
    "",
    "Inspects local Grape setup, Git state, scan diagnostics, session freshness, and refresh recommendations.",
    "",
    "Recovery:",
    "  If setup is missing or stale, run grape init --connect from the repository root."
  ].join("\n"),
  doctor: [
    "Usage:",
    "  grape doctor [--repo <path>] [--json]",
    "  grape doctor --privacy [--repo <path>] [--json]",
    "",
    "Runs setup diagnostics. Use --privacy after init to inspect local-first behavior, .grape exclusion, ignored/private inputs, and artifact secret-scan coverage."
  ].join("\n"),
  sync: [
    "Usage:",
    "  grape sync [--repo <path>] [--json]",
    "",
    "Refreshes local snapshot, evidence, and lightweight index without sending a context pack."
  ].join("\n"),
  compact: [
    "Usage:",
    "  grape compact [--repo <path>] [--json]",
    "  grape compact --dry-run [--repo <path>] [--json]",
    "  grape compact --confirm [--repo <path>] [--json]",
    "",
    "Previews or applies retention cleanup for eligible old context artifacts, compression cache rows, FTS rows, derived symbol metadata, orphan snapshots, and invalidated ledger rows.",
    "",
    "Safety:",
    "  Without --confirm, no data is deleted.",
    "  Output includes measured .grape, database, WAL, SHM, and artifact bytes before and after the run.",
    "  The current slice preserves the latest artifact per session, active sent context, restorable omitted context, and locked sessions.",
    "  The current slice preserves compression cache rows still referenced by surviving context artifacts.",
    "  The current slice deletes FTS rows only by whole snapshot and preserves the latest repo snapshot.",
    "  The current slice deletes derived symbol metadata only by whole snapshot and preserves latest or still-referenced rows.",
    "  The current slice deletes repo snapshots only when they are orphaned and have no sources, context, compression, FTS, symbol rows, or dependencies.",
    "  The current slice deletes invalidation ledger rows only with any sent rows needed to keep stale context inactive.",
    "  The current slice does not delete claims, proofs, sources, source rejections, or audit rows."
  ].join("\n"),
  export: [
    "Usage:",
    "  grape export [--repo <path>] [--json]",
    "",
    "Exports a local Grape inventory with storage bytes, row counts, source-text disclosure, and omission notes.",
    "",
    "Safety:",
    "  The export does not include raw repository source bodies.",
    "  The export does not include raw FTS text, context artifact bodies, artifact repository backing files, or database bytes.",
    "  The command may apply missing storage migrations before reading the inventory.",
    "  The command does not delete, compact, or purge local data."
  ].join("\n"),
  purge: [
    "Usage:",
    "  grape purge [--repo <path>] [--json]",
    "  grape purge --dry-run [--repo <path>] [--json]",
    "  grape purge --confirm [--repo <path>] [--json]",
    "",
    "Previews or deletes the repo-local .grape directory.",
    "",
    "Safety:",
    "  Without --confirm, no data is deleted.",
    "  The command does not delete source files, Git history, editor config, or MCP config.",
    "  The command refuses symlinked .grape state, Git-tracked paths under .grape, mismatched config roots, and locked or contended context sessions.",
    "  Confirmed purge requires .grape/config.json to match the current repository path.",
    "  After purge, run grape init --connect to create fresh local state."
  ].join("\n"),
  compile: [
    "Usage:",
    "  grape compile --task <text> [--session <id>] [--repo <path>] [--json]",
    "",
    "Compiles a task-specific context artifact and returns the session-scoped context pack diff.",
    "",
    "Common options:",
    "  --session <id>              Reuse a context session",
    "  --reset-session             Force full resend for the same task/session",
    "  --task-type <type>          bug_fix, security_fix, refactor, migration, feature, test_repair, analysis",
    "  --risk <a,b>                Add risk overlays",
    "  --token-budget <tokens>     Check whether optional context fits the budget",
    "",
    "Recovery:",
    "  Keep --task and --session stable for continued turns. Use a new session for a new task."
  ].join("\n"),
  "diff-context": [
    "Usage:",
    "  grape diff-context --task <text> [--session <id>] [--explain] [--repo <path>] [--json]",
    "",
    "Runs the same compile-plus-diff path as grape compile, labeled for scripts and agents that want the diff operation by name.",
    "",
    "Use --explain to show why each pack item is NEW, PINNED, OMIT_UNCHANGED, RESTORE_AVAILABLE, CHANGED, or INVALIDATE_PREVIOUS."
  ].join("\n"),
  mcp: [
    "Usage:",
    "  grape mcp --print-config [--repo <path>]",
    "  grape mcp --print-agents-snippet",
    "  grape mcp --install --client cursor [--repo <path>] [--dry-run] [--force]",
    "  grape mcp --install --client claude [--repo <path>] [--dry-run] [--force]",
    "  grape mcp --install --client codex [--repo <path>] [--dry-run] [--force]",
    "  grape mcp --install --client generic [--repo <path>] [--config-path <path>] [--dry-run] [--force]",
    "  grape mcp --stdio [--repo <path>]",
    "",
    "Installs MCP client config, prints manual MCP client JSON, prints AGENTS.md setup guidance, or serves Grape tools over stdio.",
    "",
    "Install behavior:",
    "  --client cursor writes project-local .cursor/mcp.json.",
    "  --client claude writes Claude Desktop claude_desktop_config.json when the platform path can be resolved.",
    "  --client codex writes project-local .codex/config.toml for trusted Codex projects.",
    "  --client generic prints JSON unless --config-path is provided, then merges mcpServers.grape into that JSON file.",
    "  --dry-run prints the target path and final config without writing.",
    "  --config-path overrides the target config file.",
    "  --force replaces only a conflicting existing Grape MCP server entry.",
    "  Unsupported clients use grape mcp --print-config for manual setup.",
    "",
    "Primary agent tool:",
    "  grape_get_context",
    "",
    "Agent instruction:",
    "  At the start of each repo task turn, call grape_get_context with a stable sessionId and the current task. Treat INVALIDATE_PREVIOUS entries as stale and unsafe. Restore omitted context by token only when needed."
  ].join("\n"),
  bench: [
    "Usage:",
    "  grape bench --fixture <name> [--fixture-path <path>] [--task <text>] [--repo <path>] [--json]",
    "",
    "Runs a scripted fixture benchmark for transport behavior. Normal projects need --fixture-path unless they contain tests/fixtures/<name>.",
    "",
    "This is a maintainer benchmark workflow, not a general repo analysis command."
  ].join("\n"),
  omitted: [
    "Usage:",
    "  grape omitted --session <id> [--repo <path>] [--json]",
    "  grape omitted --session <id> --token <restoreToken> [--repo <path>] [--json]",
    "",
    "Lists omitted context for a session or restores one omitted item after dependency checks."
  ].join("\n"),
  run: [
    "Usage:",
    "  grape run --session <id> [--repo <path>] [--json] -- <cmd...>",
    "",
    "Runs a local command from the repository root and records Grape-observed trusted command evidence without storing raw stdout or stderr."
  ].join("\n"),
  test: [
    "Usage:",
    "  grape test --session <id> [--test-framework <name>] [--repo <path>] [--json] -- <cmd...>",
    "",
    "Runs a local test command and records Grape-observed trusted test evidence without storing raw stdout or stderr."
  ].join("\n"),
  artifacts: [
    "Usage:",
    "  grape artifacts [--session <id>] [--repo <path>] [--json]",
    "  grape artifacts --artifact <id> [--repo <path>] [--json]",
    "",
    "Lists stored context artifacts or inspects one artifact's metadata, files, warnings, unsafe reasons, and dependency rows."
  ].join("\n"),
  sessions: [
    "Usage:",
    "  grape sessions [--repo <path>] [--json]",
    "",
    "Lists context sessions plus continuity evidence: sent ledger items, active sent items, omitted/restorable context, omitted token counts, stale invalidations, and session events."
  ].join("\n"),
  stale: [
    "Usage:",
    "  grape stale [--session <id>] [--repo <path>] [--json]",
    "",
    "Lists emitted INVALIDATE_PREVIOUS rows for prior context that became stale."
  ].join("\n"),
  claims: [
    "Usage:",
    "  grape claims --active [--repo <path>] [--json]",
    "",
    "Lists current-valid durable claims and proof refs without raw proof excerpts or source bodies."
  ].join("\n"),
  conflicts: [
    "Usage:",
    "  grape conflicts [--repo <path>] [--json]",
    "  grape conflicts --resolve <edgeId> --as coexists_with|variant_of [--repo <path>] [--json]",
    "",
    "Lists open claim conflict edges or records a local manual conflict resolution."
  ].join("\n"),
  proofs: [
    "Usage:",
    "  grape proofs [--proof <id>] [--source <sourceId>] [--repo <path>] [--json]",
    "",
    "Lists persisted proof metadata without raw proof excerpts or source bodies."
  ].join("\n")
};

export function write(message: string, options?: PublicOutputSanitizerOptions): void {
  process.stdout.write(`${styleHumanOutput(sanitizePublicText(message, options), { stream: "stdout" })}\n`);
}

export function writeJson(value: unknown, options?: PublicOutputSanitizerOptions): void {
  const outputOptions = optionsWithValueRootAlias(value, options);
  process.stdout.write(`${sanitizePublicText(JSON.stringify(sanitizePublicOutput(value, outputOptions), null, 2), outputOptions)}\n`);
}

export function writeError(message: string, options?: PublicOutputSanitizerOptions): void {
  process.stderr.write(`${styleHumanOutput(sanitizePublicText(message, options), { stream: "stderr" })}\n`);
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
