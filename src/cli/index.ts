#!/usr/bin/env node
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

const exitCodes = {
  ok: 0,
  usage: 1,
  unsafe: 2,
  stale: 3,
  storage: 4,
  lock: 5
} as const;

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
    case "status":
      return runStatus(parsed);
    case "doctor":
      return runDoctor(parsed);
    case "mcp":
      return runMcp(parsed);
    default:
      writeError(`Unknown command: ${parsed.command}`);
      writeError("Run grape help for available commands.");
      return exitCodes.usage;
  }
}

async function runCompile(parsed: ParsedArgs): Promise<number> {
  const usageError = rejectUnsupportedFlags(
    parsed,
    new Set(["--json", "--repo", "--task", "--task-type", "--risk", "--session"])
  );
  if (usageError) return usageError;

  const task = parsed.values.get("--task");
  if (!task) {
    writeError("grape compile requires --task <text>");
    return exitCodes.usage;
  }

  try {
    const { compileLocalContext } = await import("../app/local-project/compile.js");
    const result = compileLocalContext({
      rootPath: repoPath(parsed),
      task,
      taskType: parsed.values.get("--task-type"),
      riskOverlays: parsed.values.get("--risk"),
      sessionId: parsed.values.get("--session")
    });

    if (parsed.flags.has("--json")) {
      writeJson(result);
      return result.unsafeReasons.length === 0 ? exitCodes.ok : exitCodes.unsafe;
    }

    write([
      "Grape context compiled.",
      "",
      `Session: ${result.sessionId}`,
      `Artifact: ${result.artifactId}`,
      `Branch: ${result.branch}`,
      `Head: ${result.headCommit}`,
      `Worktree: ${result.dirtyWorktree ? "dirty" : "clean"}`,
      `Pack items: ${result.contextPackItems.length}`,
      `Sent items: ${result.sentItemCount}`,
      `Omitted unchanged: ${result.omittedItemCount}`,
      `Warnings: ${result.warnings.length === 0 ? "none" : result.warnings.join(", ")}`,
      "",
      "Files:",
      `  JSON: ${result.artifactJsonPath}`,
      `  Markdown: ${result.artifactMarkdownPath}`
    ].join("\n"));

    return result.unsafeReasons.length === 0 ? exitCodes.ok : exitCodes.unsafe;
  } catch (error) {
    writeError(`grape compile failed: ${errorMessage(error)}`);
    return compileErrorExitCode(error);
  }
}

function compileErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.startsWith("unsupported task type") || message.startsWith("unsupported risk overlay")) {
    return exitCodes.usage;
  }
  if (message.includes("may only contain letters")) return exitCodes.usage;
  if (message.includes("secret scan blocked")) return exitCodes.unsafe;
  if (message.includes("session is locked")) return exitCodes.lock;
  if (message.includes("config root path does not match")) return exitCodes.stale;
  return exitCodes.storage;
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
      `  status: ${result.mcp.status}; server pending`,
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
      ...renderProblems("Errors", status.errors)
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
      ...doctor.checks.map((check) => `${statusLabel(check.status)} ${check.id}: ${check.message}`)
    ].join("\n"));

    return doctor.overallStatus === "fail" ? exitCodes.stale : exitCodes.ok;
  } catch (error) {
    writeError(`grape doctor failed: ${errorMessage(error)}`);
    return exitCodes.stale;
  }
}

async function runMcp(parsed: ParsedArgs): Promise<number> {
  const usageError = rejectUnsupportedFlags(parsed, new Set(["--print-config", "--stdio"]));
  if (usageError) return usageError;

  if (parsed.flags.has("--print-config")) {
    const { mcpConnectionGuide } = await import("../app/local-project/mcp-guide.js");
    writeJson({
      grapeMcp: mcpConnectionGuide()
    });
    return exitCodes.ok;
  }

  if (parsed.flags.has("--stdio")) {
    writeError(
      "The MCP stdio server is not implemented in this slice. Use grape mcp --print-config for the V1 connection contract."
    );
    return exitCodes.usage;
  }

  write([
    "Grape MCP",
    "",
    "Available now:",
    "  grape mcp --print-config",
    "",
    "Planned V1 transport:",
    "  grape mcp --stdio"
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
