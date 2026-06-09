#!/usr/bin/env node
import { statusFreshnessLabel } from "../shared/trust-wording.js";
import { runArtifacts } from "./commands/artifacts.js";
import { runBench } from "./commands/bench.js";
import { runClaims } from "./commands/claims.js";
import { runCompile } from "./commands/compile.js";
import { runConflicts } from "./commands/conflicts.js";
import { runDiffContext } from "./commands/diff-context.js";
import { runOmitted } from "./commands/omitted.js";
import { runObservedCommand } from "./commands/observed-run.js";
import { runProofs } from "./commands/proofs.js";
import { runSessions } from "./commands/sessions.js";
import { runStale } from "./commands/stale.js";
import { runSync } from "./commands/sync.js";
import { exitCodes } from "./exit-codes.js";
import { parseArgs, repoPath, unsupportedFlag, type ParsedArgs } from "./args.js";
import { renderRuntimeFailure } from "./runtime-failure.js";
import { checkCliNodeRuntime } from "./runtime-guard.js";
import {
  errorMessage,
  helpText,
  initHelpText,
  repoOutputOptions,
  renderProblems,
  renderReasonCounts,
  statusLabel,
  write,
  writeError,
  writeJson
} from "./render.js";
import { isCliEntrypoint } from "./entrypoint.js";

const emitWarning = process.emitWarning;
// The published package requires Node 22.13+ so node:sqlite is available without flags.
// Keep CLI output actionable by suppressing only that runtime warning.
process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const message = typeof warning === "string" ? warning : warning.message;
  if (message.includes("SQLite is an experimental feature")) return;
  Reflect.apply(emitWarning, process, [warning, ...args]);
}) as typeof process.emitWarning;

export async function main(argv = process.argv.slice(2)): Promise<number> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    writeError(errorMessage(error));
    return exitCodes.usage;
  }

  const runtimeFailure = checkCliNodeRuntime(parsed.command, parsed.flags);
  if (runtimeFailure) return renderRuntimeFailure(parsed, runtimeFailure);

  switch (parsed.command) {
    case "":
    case "help":
    case "--help":
    case "-h":
      write(helpText());
      return exitCodes.ok;
    case "init":
      return runInit(parsed);
    case "sync":
      return runSync(parsed);
    case "compile":
      return runCompile(parsed);
    case "diff-context":
      return runDiffContext(parsed);
    case "artifacts":
      return runArtifacts(parsed);
    case "bench":
      return runBench(parsed);
    case "claims":
      return runClaims(parsed);
    case "conflicts":
      return runConflicts(parsed);
    case "status":
      return runStatus(parsed);
    case "doctor":
      return runDoctor(parsed);
    case "mcp":
      return runMcp(parsed);
    case "omitted":
      return runOmitted(parsed);
    case "proofs":
      return runProofs(parsed);
    case "run":
      return runObservedCommand(parsed, "command");
    case "sessions":
      return runSessions(parsed);
    case "stale":
      return runStale(parsed);
    case "test":
      return runObservedCommand(parsed, "test");
    default:
      writeError(`Unknown command: ${parsed.command}`);
      writeError("Run grape help for available commands.");
      return exitCodes.usage;
  }
}

async function runInit(parsed: ParsedArgs): Promise<number> {
  const usageError = rejectUnsupportedFlags(parsed, new Set(["--connect", "--json", "--repo", "--help"]));
  if (usageError) return usageError;

  if (parsed.flags.has("--help")) {
    write(initHelpText());
    return exitCodes.ok;
  }

  try {
    const rootPath = repoPath(parsed);
    const outputOptions = repoOutputOptions(rootPath);
    const { initializeLocalProject } = await import("../app/local-project/setup/initialize.js");
    const result = initializeLocalProject({
      rootPath,
      connect: parsed.flags.has("--connect")
    });

    if (parsed.flags.has("--json")) {
      writeJson(result, outputOptions);
      return exitCodes.ok;
    }

    write([
      "Grape initialized.",
      "",
      `Project: ${result.projectId}`,
      `Repo: ${result.repoId}`,
      `Branch: ${result.branch}`,
      `Head: ${result.headCommit}`,
      `Worktree: ${result.dirtyWorktree ? "dirty" : "clean"}`,
      `Config: ${result.configPath} (${result.configStatus})`,
      result.configBackupPath ? `Config backup: ${result.configBackupPath}` : undefined,
      `Database: ${result.databasePath}`,
      result.databaseBackupPath ? `Database backup: ${result.databaseBackupPath}` : undefined,
      `Migrations applied: ${result.migrationsApplied.length === 0 ? "none" : result.migrationsApplied.join(", ")}`,
      result.excludeStatus === "updated"
        ? "Privacy: added .grape/ to .git/info/exclude"
        : "Privacy: .grape/ is already locally excluded",
      "",
      "Bootstrap detection:",
      `  Languages: ${renderInlineList(result.bootstrap.languages)}`,
      `  Frameworks: ${renderInlineList(result.bootstrap.frameworks)}`,
      `  Package manager: ${result.bootstrap.packageManager ?? "unknown"}`,
      `  Scripts: ${renderInlineList(result.bootstrap.scripts)}`,
      `  Commands: ${renderInlineList(result.bootstrap.commands)}`,
      `  Test command: ${result.bootstrap.testCommand ?? "not detected"}`,
      `  Entry points: ${renderInlineList(result.bootstrap.entryPoints)}`,
      `  Config files: ${renderInlineList(result.bootstrap.configFiles)}`,
      `  Confidence: language=${result.bootstrap.confidence.language}, framework=${result.bootstrap.confidence.framework}, packageManager=${result.bootstrap.confidence.packageManager}, testCommand=${result.bootstrap.confidence.testCommand}`,
      ...renderIndentedList("  Candidate rules (not durable)", result.bootstrap.candidateRules),
      ...renderIndentedList("  Bootstrap warnings", result.bootstrap.warnings),
      "",
      "Scan diagnostics:",
      `  Visible files: ${result.scan.visibleFileCount}`,
      `  Rejected files: ${result.scan.rejectedFileCount}`,
      `  Rejection reasons: ${renderReasonCounts(result.scan.rejectionReasonCounts)}`,
      "",
      ...(parsed.flags.has("--connect")
        ? [
            "MCP integration:",
            `  command: ${result.mcp.command}`,
            `  args: ${result.mcp.args.join(" ")}`,
            `  primary tool: ${result.mcp.primaryTool}`,
            `  status: ${result.mcp.status}`,
            "",
            "Agent instruction block (paste into your MCP client):",
            ...result.mcp.agentInstructionBlock.split("\n").map((line) => (line === "" ? "" : `  ${line}`)),
            "",
            "Session transport notes:",
            `  - ${result.mcp.sessionIdentity}`,
            "  - Restore is session-bound; use restore tokens only within the same session.",
            "  - Branch, source, and dependency changes may invalidate prior sent context.",
            "",
            "Next:",
            "  grape mcp --print-config",
            "  grape status",
            "  grape doctor"
          ]
        : [
            "MCP:",
            "  Run grape init --connect for MCP integration guidance and an agent instruction block.",
            "",
            "Next:",
            "  grape status",
            "  grape doctor"
          ])
    ].filter((line): line is string => line !== undefined).join("\n"), outputOptions);

    return exitCodes.ok;
  } catch (error) {
    writeError(`grape init failed: ${errorMessage(error)}`, repoOutputOptions(repoPath(parsed)));
    return exitCodes.storage;
  }
}

async function runStatus(parsed: ParsedArgs): Promise<number> {
  const usageError = rejectUnsupportedFlags(parsed, new Set(["--json", "--repo"]));
  if (usageError) return usageError;

  try {
    const rootPath = repoPath(parsed);
    const outputOptions = repoOutputOptions(rootPath);
    const { readPublicLocalProjectStatus } = await import("../app/local-project/setup/status.js");
    const status = readPublicLocalProjectStatus(rootPath);
    if (parsed.flags.has("--json")) {
      writeJson(status, outputOptions);
      return exitCodes.ok;
    }

    write([
      `Grape context status: ${statusFreshnessLabel(status.status)}`,
      status.initialized ? "Grape project is initialized." : "Grape project is not initialized.",
      "",
      `Root: ${status.rootPath}`,
      `Config: ${status.configPresent ? "present" : "missing"}`,
      `Database: ${status.databaseExists ? "present" : "missing"}`,
      `Migrations: ${status.pendingMigrations.length === 0 ? "current" : `pending ${status.pendingMigrations.join(", ")}`}`,
      `Branch: ${status.branch ?? "unknown"}`,
      `Head: ${status.headCommit ?? "unknown"}`,
      `Worktree: ${status.dirtyWorktree === undefined ? "unknown" : status.dirtyWorktree ? "dirty" : "clean"}`,
      `Sessions: ${status.sessionFreshness.inspectedSessionCount} inspected, ${status.sessionFreshness.staleItemCount} stale invalidation(s)`,
      `Scan: ${status.scan.visibleFileCount} visible, ${status.scan.rejectedFileCount} rejected (${renderReasonCounts(status.scan.rejectionReasonCounts)})`,
      ...renderProblems("Freshness", status.freshness.reasons),
      ...renderProblems("Freshness warnings", status.freshness.warnings),
      ...renderProblems("Warnings", status.warnings),
      ...renderProblems("Errors", status.errors),
      ...renderProblems("Refresh recommendations", status.refreshRecommendations)
    ].join("\n"), outputOptions);

    return exitCodes.ok;
  } catch (error) {
    writeError(`grape status failed: ${errorMessage(error)}`, repoOutputOptions(repoPath(parsed)));
    return exitCodes.stale;
  }
}

async function runDoctor(parsed: ParsedArgs): Promise<number> {
  const usageError = rejectUnsupportedFlags(parsed, new Set(["--json", "--repo", "--privacy"]));
  if (usageError) return usageError;

  try {
    const rootPath = repoPath(parsed);
    const outputOptions = repoOutputOptions(rootPath);
    const { doctorLocalProject } = await import("../app/local-project/setup/doctor.js");
    const doctor = doctorLocalProject(rootPath, { privacyOnly: parsed.flags.has("--privacy") });
    if (parsed.flags.has("--json")) {
      writeJson(doctor, outputOptions);
      return doctor.overallStatus === "fail" ? exitCodes.stale : exitCodes.ok;
    }

    const title = parsed.flags.has("--privacy")
      ? `Grape privacy doctor: ${doctor.overallStatus}`
      : `Grape doctor: ${doctor.overallStatus}`;
    write([
      title,
      "",
      ...doctor.checks.map((check) => `${statusLabel(check.status)} ${check.id}: ${check.message}`),
      ...renderProblems("Recovery", doctor.recoveryGuidance)
    ].join("\n"), outputOptions);

    return doctor.overallStatus === "fail" ? exitCodes.stale : exitCodes.ok;
  } catch (error) {
    writeError(`grape doctor failed: ${errorMessage(error)}`, repoOutputOptions(repoPath(parsed)));
    return exitCodes.stale;
  }
}

async function runMcp(parsed: ParsedArgs): Promise<number> {
  const usageError = rejectUnsupportedFlags(parsed, new Set(["--print-config", "--stdio", "--repo"]));
  if (usageError) return usageError;

  if (parsed.flags.has("--print-config")) {
    const { mcpConnectionGuide } = await import("../app/local-project/setup/mcp-guide.js");
    const rootPath = repoPath(parsed);
    writeJson({
      grapeMcp: mcpConnectionGuide(rootPath)
    }, repoOutputOptions(rootPath));
    return exitCodes.ok;
  }

  if (parsed.flags.has("--stdio")) {
    const { runStdioMcpServer } = await import("../mcp/index.js");
    return runStdioMcpServer({ rootPath: repoPath(parsed) });
  }

  write([
    "Grape MCP",
    "",
    "Available now:",
    "  grape mcp --print-config",
    "  grape mcp --stdio",
    "",
    "Tools:",
    "  grape_get_context",
    "  grape_get_artifact",
    "  grape_get_claims",
    "  grape_get_proofs",
    "  grape_get_rules",
    "  grape_get_omitted_item",
    "  grape_get_stale_items",
    "  grape_get_conflicts",
    "  grape_get_status",
    "  grape_record_candidate",
    "  grape_record_command_result",
    "  grape_record_test_result",
    "  grape_record_user_decision",
    "  grape_request_user_confirmation"
  ].join("\n"));
  return exitCodes.ok;
}

function rejectUnsupportedFlags(parsed: ParsedArgs, allowed: ReadonlySet<string>): number | undefined {
  const flag = unsupportedFlag(parsed, allowed);
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }
  return undefined;
}

function renderInlineList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

function renderIndentedList(title: string, values: readonly string[]): string[] {
  if (values.length === 0) return [`${title}: none`];
  return [`${title}:`, ...values.map((value) => `    - ${value}`)];
}

if (isCliEntrypoint(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      writeError(errorMessage(error));
      process.exitCode = exitCodes.usage;
    });
}
