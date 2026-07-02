#!/usr/bin/env node
import type { LocalBootstrapDetection } from "../app/local-project/setup/bootstrap-detection.js";
import type { LocalScanDiagnostics } from "../app/local-project/setup/scan-diagnostics.js";
import { statusFreshnessLabel } from "../shared/trust-wording.js";
import { runArtifacts } from "./commands/artifacts.js";
import { runBench } from "./commands/bench.js";
import { runClaims } from "./commands/claims.js";
import { runCompact } from "./commands/compact.js";
import { runCompile } from "./commands/compile.js";
import { runConflicts } from "./commands/conflicts.js";
import { runDiffContext } from "./commands/diff-context.js";
import { runExport } from "./commands/export.js";
import { runMcp } from "./commands/mcp.js";
import { runOmitted } from "./commands/omitted.js";
import { runObservedCommand } from "./commands/observed-run.js";
import { runProofs } from "./commands/proofs.js";
import { runPurge } from "./commands/purge.js";
import { runSessions } from "./commands/sessions.js";
import { runStale } from "./commands/stale.js";
import { runSync } from "./commands/sync.js";
import { exitCodes } from "./exit-codes.js";
import { parseArgs, repoPath, unsupportedFlag, type ParsedArgs } from "./args.js";
import { renderRuntimeFailure } from "./runtime-failure.js";
import { checkCliNodeRuntime } from "./runtime-guard.js";
import {
  errorMessage,
  formatCommandFailure,
  commandHelpText,
  helpText,
  humanizeStatusWarning,
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
import { PACKAGE_VERSION } from "../shared/package-version.js";

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
    case "--version":
    case "-v":
    case "version":
      write(`grape-context ${PACKAGE_VERSION}`);
      return exitCodes.ok;
  }

  if (parsed.flags.has("--help")) {
    const commandHelp = commandHelpText(parsed.command);
    if (commandHelp) {
      write(commandHelp);
      return exitCodes.ok;
    }
  }

  switch (parsed.command) {
    case "init":
      return runInit(parsed);
    case "sync":
      return runSync(parsed);
    case "compile":
      return runCompile(parsed);
    case "compact":
      return runCompact(parsed);
    case "export":
      return runExport(parsed);
    case "purge":
      return runPurge(parsed);
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
  const usageError = rejectUnsupportedFlags(parsed, new Set(["--connect", "--json", "--repo", "--help", "--dry-run"]));
  if (usageError) return usageError;

  if (parsed.flags.has("--help")) {
    write(initHelpText());
    return exitCodes.ok;
  }

  try {
    const rootPath = repoPath(parsed);
    const { initializeLocalProject, previewInitializeLocalProject } = await import("../app/local-project/setup/initialize.js");

    if (parsed.flags.has("--dry-run")) {
      const result = previewInitializeLocalProject({
        rootPath,
        connect: parsed.flags.has("--connect")
      });
      const outputOptions = repoOutputOptions(rootPath, [result.rootPath]);

      if (parsed.flags.has("--json")) {
        writeJson(result, outputOptions);
        return exitCodes.ok;
      }

      write([
        "Dry run: no changes written.",
        "",
        `Project: ${result.projectId}`,
        `Repo: ${result.repoId}`,
        `Branch: ${result.branch}`,
        `Head: ${result.headCommit}`,
        `Worktree: ${result.dirtyWorktree ? "dirty" : "clean"}`,
        `Config: ${result.configPath} (would create or repair)`,
        `Database: ${result.databasePath} (would create or migrate)`,
        "Privacy: would ensure .grape/ is in .git/info/exclude",
        "",
        "Planned writes:",
        ...result.plannedWrites.map((plannedWrite) => `  ${plannedWrite}`),
        "",
        ...renderBootstrapDetection(result.bootstrap),
        ...renderScanDiagnostics(result.scan),
        "",
        "Next:",
        "  grape init --connect",
        "  grape mcp --install --client cursor",
        "  grape mcp --install --client claude",
        "  grape mcp --install --client codex"
      ].join("\n"), outputOptions);
      return exitCodes.ok;
    }

    const result = initializeLocalProject({
      rootPath,
      connect: parsed.flags.has("--connect")
    });
    const outputOptions = repoOutputOptions(rootPath, [result.rootPath]);

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
      ...renderBootstrapDetection(result.bootstrap),
      ...renderScanDiagnostics(result.scan),
      "",
      ...(parsed.flags.has("--connect")
        ? [
            "MCP integration:",
            `  command: ${result.mcp.command}`,
            `  args: ${result.mcp.args.join(" ")}`,
            `  primary tool: ${result.mcp.primaryTool}`,
            `  status: ${result.mcp.status}`,
            "",
            "Install MCP client config:",
            "  Cursor: grape mcp --install --client cursor",
            "  Claude Desktop: grape mcp --install --client claude",
            "  Codex: grape mcp --install --client codex",
            "  Preview first: add --dry-run",
            "  AGENTS.md snippet: grape mcp --print-agents-snippet",
            "  Manual fallback: grape mcp --print-config",
            "",
            "Agent instruction block:",
            ...result.mcp.agentInstructionBlock.split("\n").map((line) => (line === "" ? "" : `  ${line}`)),
            "",
            "Session transport notes:",
            `  - ${result.mcp.sessionIdentity}`,
            "  - Restore is session-bound; use restore tokens only within the same session.",
            "  - Branch, source, and dependency changes may invalidate prior sent context.",
            "",
            "Next:",
            "  grape mcp --install --client cursor",
            "  grape mcp --install --client claude",
            "  grape mcp --install --client codex",
            "  grape mcp --print-agents-snippet",
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
    const { recoveryGuidanceForErrorMessage } = await import("../app/local-project/setup/recovery.js");
    writeError(
      formatCommandFailure("init", error, recoveryGuidanceForErrorMessage(errorMessage(error))),
      repoOutputOptions(repoPath(parsed))
    );
    return exitCodes.storage;
  }
}

async function runStatus(parsed: ParsedArgs): Promise<number> {
  const usageError = rejectUnsupportedFlags(parsed, new Set(["--json", "--repo"]));
  if (usageError) return usageError;

  try {
    const rootPath = repoPath(parsed);
    const { readPublicLocalProjectStatus } = await import("../app/local-project/setup/status.js");
    const status = readPublicLocalProjectStatus(rootPath);
    const outputOptions = repoOutputOptions(rootPath, [status.rootPath]);
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
      ...renderProblems("Freshness warnings", status.freshness.warnings.map(humanizeStatusWarning)),
      ...renderProblems("Warnings", status.warnings),
      ...renderProblems("Errors", status.errors),
      ...renderProblems("Refresh recommendations", status.refreshRecommendations)
    ].join("\n"), outputOptions);

    return exitCodes.ok;
  } catch (error) {
    const { recoveryGuidanceForErrorMessage } = await import("../app/local-project/setup/recovery.js");
    writeError(
      formatCommandFailure("status", error, recoveryGuidanceForErrorMessage(errorMessage(error))),
      repoOutputOptions(repoPath(parsed))
    );
    return exitCodes.stale;
  }
}

async function runDoctor(parsed: ParsedArgs): Promise<number> {
  const usageError = rejectUnsupportedFlags(parsed, new Set(["--json", "--repo", "--privacy"]));
  if (usageError) return usageError;

  try {
    const rootPath = repoPath(parsed);
    const { doctorLocalProject } = await import("../app/local-project/setup/doctor.js");
    const doctor = doctorLocalProject(rootPath, { privacyOnly: parsed.flags.has("--privacy") });
    const outputOptions = repoOutputOptions(rootPath, [doctor.rootPath]);
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
    const { recoveryGuidanceForErrorMessage } = await import("../app/local-project/setup/recovery.js");
    writeError(
      formatCommandFailure("doctor", error, recoveryGuidanceForErrorMessage(errorMessage(error))),
      repoOutputOptions(repoPath(parsed))
    );
    return exitCodes.stale;
  }
}

function rejectUnsupportedFlags(parsed: ParsedArgs, allowed: ReadonlySet<string>): number | undefined {
  const flag = unsupportedFlag(parsed, allowed);
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    writeError("Run grape help for supported options.");
    return exitCodes.usage;
  }
  return undefined;
}

function renderInlineList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

function renderBootstrapDetection(bootstrap: LocalBootstrapDetection): string[] {
  return [
    "Bootstrap detection:",
    `  Languages: ${renderInlineList(bootstrap.languages)}`,
    `  Frameworks: ${renderInlineList(bootstrap.frameworks)}`,
    `  Package manager: ${bootstrap.packageManager ?? "unknown"}`,
    `  Scripts: ${renderInlineList(bootstrap.scripts)}`,
    `  Commands: ${renderInlineList(bootstrap.commands)}`,
    `  Test command: ${bootstrap.testCommand ?? "not detected"}`,
    `  Entry points: ${renderInlineList(bootstrap.entryPoints)}`,
    `  Config files: ${renderInlineList(bootstrap.configFiles)}`,
    `  Confidence: language=${bootstrap.confidence.language}, framework=${bootstrap.confidence.framework}, packageManager=${bootstrap.confidence.packageManager}, testCommand=${bootstrap.confidence.testCommand}`,
    ...renderIndentedList("  Candidate rules (not durable)", bootstrap.candidateRules),
    ...renderIndentedList("  Bootstrap warnings", bootstrap.warnings),
    ""
  ];
}

function renderScanDiagnostics(scan: LocalScanDiagnostics): string[] {
  return [
    "Scan diagnostics:",
    `  Visible files: ${scan.visibleFileCount}`,
    `  Rejected files: ${scan.rejectedFileCount}`,
    `  Rejection reasons: ${renderReasonCounts(scan.rejectionReasonCounts)}`
  ];
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
