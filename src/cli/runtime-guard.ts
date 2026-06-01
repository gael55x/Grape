import { describeNodeRuntimeRequirement, type NodeRuntimeRequirement } from "../shared/index.js";

export interface CliNodeRuntimeFailure {
  readonly runtime: NodeRuntimeRequirement;
  readonly message: string;
  readonly recoveryGuidance: readonly string[];
}

const storageBackedCommands = new Set([
  "artifacts",
  "bench",
  "claims",
  "compile",
  "conflicts",
  "diff-context",
  "doctor",
  "init",
  "omitted",
  "proofs",
  "run",
  "sessions",
  "stale",
  "status",
  "sync",
  "test"
]);

export function checkCliNodeRuntime(
  command: string,
  flags: ReadonlySet<string>,
  actualVersion = process.versions.node
): CliNodeRuntimeFailure | undefined {
  if (!commandRequiresSupportedNodeRuntime(command, flags)) return undefined;

  const runtime = describeNodeRuntimeRequirement(actualVersion);
  if (runtime.supported) return undefined;

  return {
    runtime,
    message: `Node.js ${runtime.actualVersion} is below Grape's required >=${runtime.minimumVersion} runtime.`,
    recoveryGuidance: [
      `Use Node.js ${runtime.minimumVersion} or newer before running this Grape command.`,
      "After switching Node versions, rerun grape init --connect from the repository root."
    ]
  };
}

export function commandRequiresSupportedNodeRuntime(command: string, flags: ReadonlySet<string>): boolean {
  if (flags.has("--help")) return false;
  if (command === "mcp") return flags.has("--stdio");
  return storageBackedCommands.has(command);
}
