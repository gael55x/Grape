import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

import { hashStableParts } from "../../../core/evidence/index.js";
import { assertArtifactTextHasNoSecrets } from "../../../core/security/index.js";
import {
  recordLocalGrapeObservedCommandResult,
  recordLocalGrapeObservedTestResult
} from "./recording.js";
import { sha256 } from "../context/compile-ids.js";
import { normalizeRepoRelativePath } from "./path.js";
import type { RecordLocalObservationResult } from "./types.js";

export interface RunLocalObservedCommandInput {
  readonly rootPath: string;
  readonly sessionId: string;
  readonly commandArgs: readonly string[];
  readonly mode: "command" | "test";
  readonly testFramework?: string;
  readonly now?: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export interface RunLocalObservedCommandResult {
  readonly rootPath: string;
  readonly observedRunId: string;
  readonly sourceId: string;
  readonly sourceType: "command_run" | "test_run";
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly trustClass: "trusted";
  readonly observedBy: "grape";
  readonly durable: boolean;
  readonly durableClaim: boolean;
  readonly proofId?: string;
  readonly claimId?: string;
  readonly claimType?: string;
  readonly commandHash: string;
  readonly cwd: string;
  readonly exitCode: number;
  readonly passed?: boolean;
  readonly stdoutHash: string;
  readonly stderrHash: string;
  readonly stdoutBytes: number;
  readonly stderrBytes: number;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly inserted: boolean;
  readonly redactedFields: readonly string[];
  readonly warnings: readonly string[];
}

export function runLocalObservedCommand(input: RunLocalObservedCommandInput): RunLocalObservedCommandResult {
  const commandArgs = normalizeCommandArgs(input.commandArgs);
  const commandText = commandArgs.join(" ");
  assertArtifactTextHasNoSecrets(commandText, "grape observed command");
  const startedAt = input.now ?? new Date().toISOString();
  const run = spawnSync(commandArgs[0], commandArgs.slice(1), {
    cwd: input.rootPath,
    encoding: "buffer",
    maxBuffer: 32 * 1024 * 1024
  });
  const endedAt = new Date().toISOString();
  const stdout = Buffer.isBuffer(run.stdout) ? run.stdout : Buffer.alloc(0);
  const stderr = run.error
    ? Buffer.concat([Buffer.isBuffer(run.stderr) ? run.stderr : Buffer.alloc(0), Buffer.from(run.error.message)])
    : Buffer.isBuffer(run.stderr)
      ? run.stderr
      : Buffer.alloc(0);
  const exitCode = run.status ?? 127;
  const commandHash = sha256(commandText);
  const stdoutHash = sha256Buffer(stdout);
  const stderrHash = sha256Buffer(stderr);
  const observedRunId = `run:${hashStableParts([
    input.rootPath,
    input.sessionId,
    input.mode,
    commandHash,
    stdoutHash,
    stderrHash,
    String(exitCode),
    startedAt,
    endedAt
  ]).slice(0, 24)}`;

  const observation = persistObservedResult(input, {
    observedRunId,
    command: commandText,
    commandHash,
    exitCode,
    stdoutHash,
    stderrHash,
    startedAt,
    endedAt
  });

  return {
    rootPath: observation.rootPath,
    observedRunId,
    sourceId: observation.sourceId,
    sourceType: observation.sourceType,
    sourceRef: observation.sourceRef,
    sourceHash: observation.sourceHash,
    trustClass: "trusted",
    observedBy: "grape",
    durable: observation.durable,
    durableClaim: observation.durableClaim,
    proofId: observation.proofId,
    claimId: observation.claimId,
    claimType: observation.claimType,
    commandHash,
    cwd: ".",
    exitCode,
    passed: input.mode === "test" ? exitCode === 0 : undefined,
    stdoutHash,
    stderrHash,
    stdoutBytes: stdout.length,
    stderrBytes: stderr.length,
    startedAt,
    endedAt,
    inserted: observation.inserted,
    redactedFields: observation.redactedFields,
    warnings: observation.warnings
  };
}

function persistObservedResult(
  input: RunLocalObservedCommandInput,
  observed: {
    readonly observedRunId: string;
    readonly command: string;
    readonly commandHash: string;
    readonly exitCode: number;
    readonly stdoutHash: string;
    readonly stderrHash: string;
    readonly startedAt: string;
    readonly endedAt: string;
  }
): RecordLocalObservationResult {
  const base = {
    rootPath: input.rootPath,
    sessionId: input.sessionId,
    command: observed.command,
    commandHash: observed.commandHash,
    cwd: ".",
    exitCode: observed.exitCode,
    stdoutHash: observed.stdoutHash,
    stderrHash: observed.stderrHash,
    startedAt: observed.startedAt,
    endedAt: observed.endedAt,
    now: observed.endedAt,
    observedRunId: observed.observedRunId,
    gitBinary: input.gitBinary,
    migrationsDir: input.migrationsDir
  };
  return input.mode === "test"
    ? recordLocalGrapeObservedTestResult({
        ...base,
        passed: observed.exitCode === 0,
        testFramework: input.testFramework,
        testFiles: explicitTestFileRefs(input.rootPath, input.commandArgs)
      })
    : recordLocalGrapeObservedCommandResult(base);
}

function explicitTestFileRefs(rootPath: string, commandArgs: readonly string[]): readonly string[] {
  const refs = new Set<string>();
  for (const arg of commandArgs) {
    const ref = explicitTestFileRef(rootPath, arg);
    if (ref) refs.add(ref);
  }
  return [...refs].sort();
}

function explicitTestFileRef(rootPath: string, arg: string): string | undefined {
  if (arg.startsWith("-") || arg.includes("\0")) return undefined;
  let ref: string;
  try {
    ref = normalizeRepoRelativePath(rootPath, arg, "test file");
  } catch {
    return undefined;
  }
  if (!isLikelyTestFileRef(ref)) return undefined;
  const stat = statSync(path.join(rootPath, ref), { throwIfNoEntry: false });
  return stat?.isFile() ? ref : undefined;
}

function isLikelyTestFileRef(ref: string): boolean {
  return /(?:^|\/)[^/]+\.(?:test|spec)\.(?:[cm]?js|[cm]?ts|jsx|tsx)$/.test(ref);
}

function normalizeCommandArgs(commandArgs: readonly string[]): readonly string[] {
  if (commandArgs.length === 0) throw new Error("observed command requires arguments after --");
  for (const arg of commandArgs) {
    if (typeof arg !== "string" || arg.length === 0) {
      throw new Error("observed command arguments must be non-empty strings");
    }
  }
  return commandArgs;
}

function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
