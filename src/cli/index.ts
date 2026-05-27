#!/usr/bin/env node
import { runArtifacts } from "./commands/artifacts.js";
import { runClaims } from "./commands/claims.js";
import { runCompile } from "./commands/compile.js";
import { runConflicts } from "./commands/conflicts.js";
import { runOmitted } from "./commands/omitted.js";
import { runProofs } from "./commands/proofs.js";
import { runSessions } from "./commands/sessions.js";
import { runStale } from "./commands/stale.js";
import { exitCodes } from "./exit-codes.js";
import { parseArgs, repoPath, unsupportedFlag, type ParsedArgs } from "./args.js";
import {
  errorMessage,
  helpText,
  initHelpText,
  renderProblems,
  statusLabel,
  write,
  writeError,
  writeJson
} from "./render.js";

const emitWarning = process.emitWarning;
// Node 22.5+ ships the SQLite runtime Grape uses, but still labels it experimental.
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

  switch (parsed.command) {
    case "":
    case "help":
    case "--help":
    case "-h":
      write(helpText());
      return exitCodes.ok;
    case "init":
      return runInit(parsed);
    case "compile":
      return runCompile(parsed);
    case "artifacts":
      return runArtifacts(parsed);
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
    case "sessions":
      return runSessions(parsed);
    case "stale":
      return runStale(parsed);
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
    const { initializeLocalProject } = await import("../app/local-project/initialize.js");
    const result = initializeLocalProject({
      rootPath: repoPath(parsed),
      connect: parsed.flags.has("--connect")
    });

    if (parsed.flags.has("--json")) {
      writeJson(result);
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
      `Database: ${result.databasePath}`,
      `Migrations applied: ${result.migrationsApplied.length === 0 ? "none" : result.migrationsApplied.join(", ")}`,
      result.excludeStatus === "updated"
        ? "Privacy: added .grape/ to .git/info/exclude"
        : "Privacy: .grape/ is already locally excluded",
      "",
      "MCP connection contract:",
      `  command: ${result.mcp.command}`,
      `  args: ${result.mcp.args.join(" ")}`,
      `  status: ${result.mcp.status}`,
      "",
      "Next:",
      "  grape status",
      "  grape doctor",
      "  grape mcp --print-config"
    ].join("\n"));

    return exitCodes.ok;
  } catch (error) {
    writeError(`grape init failed: ${errorMessage(error)}`);
    return exitCodes.storage;
  }
}

async function runStatus(parsed: ParsedArgs): Promise<number> {
  const usageError = rejectUnsupportedFlags(parsed, new Set(["--json", "--repo"]));
  if (usageError) return usageError;

  try {
    const { readLocalProjectStatus } = await import("../app/local-project/status.js");
    const status = readLocalProjectStatus(repoPath(parsed));
    if (parsed.flags.has("--json")) {
      writeJson(status);
      return status.errors.length === 0 ? exitCodes.ok : exitCodes.stale;
    }

    write([
      status.initialized ? "Grape project is initialized." : "Grape project is not initialized.",
      "",
      `Root: ${status.rootPath}`,
      `Config: ${status.config ? "present" : "missing"}`,
      `Database: ${status.databaseExists ? "present" : "missing"}`,
      `Migrations: ${status.pendingMigrations.length === 0 ? "current" : `pending ${status.pendingMigrations.join(", ")}`}`,
      `Branch: ${status.branch ?? "unknown"}`,
      `Head: ${status.headCommit ?? "unknown"}`,
      `Worktree: ${status.dirtyWorktree === undefined ? "unknown" : status.dirtyWorktree ? "dirty" : "clean"}`,
      ...renderProblems("Warnings", status.warnings),
      ...renderProblems("Errors", status.errors),
      ...renderProblems("Recovery", status.recoveryGuidance)
    ].join("\n"));

    return status.errors.length === 0 ? exitCodes.ok : exitCodes.stale;
  } catch (error) {
    writeError(`grape status failed: ${errorMessage(error)}`);
    return exitCodes.stale;
  }
}

async function runDoctor(parsed: ParsedArgs): Promise<number> {
  const usageError = rejectUnsupportedFlags(parsed, new Set(["--json", "--repo"]));
  if (usageError) return usageError;

  try {
    const { doctorLocalProject } = await import("../app/local-project/doctor.js");
    const doctor = doctorLocalProject(repoPath(parsed));
    if (parsed.flags.has("--json")) {
      writeJson(doctor);
      return doctor.overallStatus === "fail" ? exitCodes.stale : exitCodes.ok;
    }

    write([
      `Grape doctor: ${doctor.overallStatus}`,
      "",
      ...doctor.checks.map((check) => `${statusLabel(check.status)} ${check.id}: ${check.message}`),
      ...renderProblems("Recovery", doctor.recoveryGuidance)
    ].join("\n"));

    return doctor.overallStatus === "fail" ? exitCodes.stale : exitCodes.ok;
  } catch (error) {
    writeError(`grape doctor failed: ${errorMessage(error)}`);
    return exitCodes.stale;
  }
}

async function runMcp(parsed: ParsedArgs): Promise<number> {
  const usageError = rejectUnsupportedFlags(parsed, new Set(["--print-config", "--stdio", "--repo"]));
  if (usageError) return usageError;

  if (parsed.flags.has("--print-config")) {
    const { mcpConnectionGuide } = await import("../app/local-project/mcp-guide.js");
    writeJson({
      grapeMcp: mcpConnectionGuide(repoPath(parsed))
    });
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
    "  grape_record_command_result",
    "  grape_record_test_result"
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      writeError(errorMessage(error));
      process.exitCode = exitCodes.usage;
    });
}
