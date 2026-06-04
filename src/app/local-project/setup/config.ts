import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";

export const localProjectSchemaVersion = 1;

export interface LocalProjectPaths {
  readonly grapeDir: string;
  readonly database: string;
  readonly artifacts: string;
  readonly logs: string;
  readonly tmp: string;
}

export interface LocalProjectConfig {
  readonly schemaVersion: 1;
  readonly runtime: "node";
  readonly storage: "sqlite";
  readonly defaultEnvironment: "local";
  readonly project: {
    readonly projectId: string;
    readonly repoId: string;
    readonly rootPath: string;
    readonly initializedAt: string;
  };
  readonly mcp: {
    readonly enabled: boolean;
    readonly transport: "stdio";
  };
  readonly indexing: {
    readonly languages: readonly string[];
    readonly maxFileSizeKb: number;
    readonly respectGitignore: boolean;
    readonly respectAiIgnore: boolean;
    readonly respectGrapeIgnore: boolean;
  };
  readonly context: {
    readonly defaultTokenBudget: number;
    readonly minimumSafetyBudget: number;
    readonly resendPinnedOnSessionReset: boolean;
    readonly restoreOmittedItems: boolean;
  };
  readonly compression: {
    readonly enabled: boolean;
    readonly mode: "lightweight";
    readonly allowModelSummaries: boolean;
    readonly invalidateOnInputHashChange: boolean;
    readonly summaryAsProof: "blocked";
  };
  readonly privacy: {
    readonly localOnly: boolean;
    readonly secretScan: boolean;
    readonly redactEnvValues: boolean;
  };
  readonly platform: {
    readonly normalizePaths: boolean;
    readonly followSymlinks: boolean;
  };
  readonly paths: LocalProjectPaths;
}

export interface LocalProjectLayout {
  readonly rootPath: string;
  readonly grapeDirPath: string;
  readonly configPath: string;
  readonly databasePath: string;
  readonly artifactDirPath: string;
  readonly createdDirs: readonly string[];
}

export type LocalProjectConfigWriteStatus = "created" | "unchanged" | "repaired";

export interface LocalProjectConfigWriteResult {
  readonly status: LocalProjectConfigWriteStatus;
  readonly backupPath?: string;
}

const localDirectories = [
  ".grape",
  ".grape/artifacts",
  ".grape/context",
  ".grape/context/sessions",
  ".grape/context/branches",
  ".grape/logs",
  ".grape/cache",
  ".grape/cache/parser",
  ".grape/cache/lexical",
  ".grape/cache/compression",
  ".grape/cache/compression/symbol_outlines",
  ".grape/cache/compression/rule_digests",
  ".grape/cache/compression/context_pack_summaries",
  ".grape/cache/compression/decision_digests",
  ".grape/cache/compression/failure_timelines",
  ".grape/cache/compression/module_outlines",
  ".grape/tmp"
] as const;

export function ensureLocalProjectLayout(rootPath: string): LocalProjectLayout {
  const normalizedRoot = path.resolve(rootPath);
  const createdDirs: string[] = [];

  for (const relativeDir of localDirectories) {
    const absoluteDir = path.join(normalizedRoot, relativeDir);
    if (existsSync(absoluteDir)) {
      assertSafeLocalDirectory(normalizedRoot, absoluteDir, relativeDir);
    } else {
      mkdirSync(absoluteDir, { recursive: true });
      createdDirs.push(relativeDir);
      assertSafeLocalDirectory(normalizedRoot, absoluteDir, relativeDir);
    }
  }
  assertSafeLocalStateFile(path.join(normalizedRoot, ".grape", "config.json"), ".grape/config.json");
  assertSafeLocalStateFile(path.join(normalizedRoot, ".grape", "grape.db"), ".grape/grape.db");
  assertSafeLocalStateFile(path.join(normalizedRoot, ".grape", "grape.db-wal"), ".grape/grape.db-wal");
  assertSafeLocalStateFile(path.join(normalizedRoot, ".grape", "grape.db-shm"), ".grape/grape.db-shm");

  return {
    rootPath: normalizedRoot,
    grapeDirPath: path.join(normalizedRoot, ".grape"),
    configPath: path.join(normalizedRoot, ".grape", "config.json"),
    databasePath: path.join(normalizedRoot, ".grape", "grape.db"),
    artifactDirPath: path.join(normalizedRoot, ".grape", "artifacts"),
    createdDirs
  };
}

function assertSafeLocalDirectory(rootPath: string, absoluteDir: string, relativeDir: string): void {
  const stat = lstatSync(absoluteDir);
  if (stat.isSymbolicLink()) {
    throw new Error(`Grape local directory must not be a symlink: ${relativeDir}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`Grape local path must be a directory: ${relativeDir}`);
  }
  const realRoot = realpathSync(rootPath);
  const realDir = realpathSync(absoluteDir);
  if (!isInsideOrSame(realRoot, realDir)) {
    throw new Error(`Grape local directory escaped the repository root: ${relativeDir}`);
  }
}

function assertSafeLocalStateFile(absolutePath: string, relativePath: string): void {
  if (!existsSync(absolutePath)) return;
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    throw new Error(`Grape local state file must not be a symlink: ${relativePath}`);
  }
  if (!stat.isFile()) {
    throw new Error(`Grape local state path must be a file: ${relativePath}`);
  }
}

function isInsideOrSame(rootPath: string, absolutePath: string): boolean {
  const relativePath = path.relative(rootPath, absolutePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

export function defaultLocalProjectConfig(input: {
  readonly projectId: string;
  readonly repoId: string;
  readonly rootPath: string;
  readonly initializedAt: string;
}): LocalProjectConfig {
  return {
    schemaVersion: localProjectSchemaVersion,
    runtime: "node",
    storage: "sqlite",
    defaultEnvironment: "local",
    project: {
      projectId: input.projectId,
      repoId: input.repoId,
      rootPath: path.resolve(input.rootPath),
      initializedAt: input.initializedAt
    },
    mcp: {
      enabled: true,
      transport: "stdio"
    },
    indexing: {
      languages: ["typescript", "tsx", "javascript", "python", "markdown", "json", "yaml"],
      maxFileSizeKb: 512,
      respectGitignore: true,
      respectAiIgnore: true,
      respectGrapeIgnore: true
    },
    context: {
      defaultTokenBudget: 24000,
      minimumSafetyBudget: 4000,
      resendPinnedOnSessionReset: true,
      restoreOmittedItems: true
    },
    compression: {
      enabled: true,
      mode: "lightweight",
      allowModelSummaries: false,
      invalidateOnInputHashChange: true,
      summaryAsProof: "blocked"
    },
    privacy: {
      localOnly: true,
      secretScan: true,
      redactEnvValues: true
    },
    platform: {
      normalizePaths: true,
      followSymlinks: false
    },
    paths: {
      grapeDir: ".grape",
      database: ".grape/grape.db",
      artifacts: ".grape/artifacts",
      logs: ".grape/logs",
      tmp: ".grape/tmp"
    }
  };
}

export function readLocalProjectConfig(configPath: string): LocalProjectConfig | undefined {
  if (!existsSync(configPath)) return undefined;

  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Partial<LocalProjectConfig>;
  if (parsed.schemaVersion === undefined) {
    throw new Error("Grape config is missing schema version.");
  }
  if (parsed.schemaVersion !== localProjectSchemaVersion) {
    throw new Error(`unsupported Grape config schema version: ${String(parsed.schemaVersion)}`);
  }
  if (!parsed.project?.projectId || !parsed.project.repoId || !parsed.project.rootPath) {
    throw new Error("Grape config is missing project identity.");
  }

  return parsed as LocalProjectConfig;
}

export function isRepairableLocalProjectConfigError(error: unknown): boolean {
  if (error instanceof SyntaxError) return true;

  const message = errorMessage(error);
  return (
    message === "Grape config is missing schema version." ||
    message === "Grape config is missing project identity."
  );
}

export function writeLocalProjectConfig(
  configPath: string,
  config: LocalProjectConfig,
  input: { readonly now?: string } = {}
): LocalProjectConfigWriteResult {
  if (existsSync(configPath)) {
    let existing: LocalProjectConfig | undefined;
    try {
      existing = readLocalProjectConfig(configPath);
    } catch (error) {
      if (!isRepairableLocalProjectConfigError(error)) throw error;
      const backupPath = backupInvalidConfig(configPath, input.now);
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
      return { status: "repaired", backupPath };
    }

    if (existing?.project.projectId !== config.project.projectId || existing.project.repoId !== config.project.repoId) {
      throw new Error("existing Grape config points at a different project or repository.");
    }
    return { status: "unchanged" };
  }

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return { status: "created" };
}

function backupInvalidConfig(configPath: string, now = new Date().toISOString()): string {
  const backupPath = uniqueConfigBackupPath(configPath, now);
  copyFileSync(configPath, backupPath);
  return backupPath;
}

function uniqueConfigBackupPath(configPath: string, now: string): string {
  const directory = path.dirname(configPath);
  const stamp = now.replace(/[^0-9A-Za-z.-]/g, "-");
  const base = path.join(directory, `config.invalid.${stamp}.json`);

  if (!existsSync(base)) return base;

  for (let index = 1; index < 1000; index += 1) {
    const candidate = path.join(directory, `config.invalid.${stamp}.${index}.json`);
    if (!existsSync(candidate)) return candidate;
  }

  throw new Error("could not create a unique backup path for invalid Grape config.");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
