export interface ParsedArgs {
  readonly command: string;
  readonly flags: Set<string>;
  readonly values: Map<string, string>;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const valueOptions = new Set([
    "--repo",
    "--task",
    "--task-type",
    "--risk",
    "--session",
    "--token",
    "--artifact"
  ]);

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (valueOptions.has(arg)) {
      const value = rest[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      values.set(arg, value);
      index += 1;
      continue;
    }
    flags.add(arg);
  }

  return { command, flags, values };
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
