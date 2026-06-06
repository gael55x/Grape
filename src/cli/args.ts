export interface ParsedArgs {
  readonly command: string;
  readonly flags: Set<string>;
  readonly values: Map<string, string>;
  readonly positionals: readonly string[];
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const valueOptions = new Set([
    "--repo",
    "--task",
    "--task-type",
    "--environment-scope",
    "--feature-flags",
    "--risk",
    "--session",
    "--token-budget",
    "--token",
    "--artifact",
    "--proof",
    "--resolve",
    "--source",
    "--as",
    "--fixture",
    "--fixture-path",
    "--test-framework"
  ]);
  const positionals: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--") {
      positionals.push(...rest.slice(index + 1));
      break;
    }
    if (valueOptions.has(arg)) {
      const value = rest[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      values.set(arg, value);
      index += 1;
      continue;
    }
    flags.add(arg);
  }

  return { command, flags, values, positionals };
}

export function repoPath(parsed: ParsedArgs): string {
  return parsed.values.get("--repo") ?? process.cwd();
}

export function unsupportedFlag(
  parsed: ParsedArgs,
  allowed: ReadonlySet<string>
): string | undefined {
  for (const flag of parsed.flags) {
    if (!allowed.has(flag)) return flag;
  }
  return undefined;
}
