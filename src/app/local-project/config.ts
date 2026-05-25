import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const localDirectories = [
  ".grape",
  ".grape/artifacts",
  ".grape/context",
  ".grape/context/sessions",
  ".grape/context/branches",
  ".grape/logs",
  ".grape/cache",
  ".grape/cache/parser",
  ".grape/cache/fts",
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
    if (!existsSync(absoluteDir)) {
      mkdirSync(absoluteDir, { recursive: true });
      createdDirs.push(relativeDir);
    }
  }

  return {
    rootPath: normalizedRoot,
    grapeDirPath: path.join(normalizedRoot, ".grape"),
    configPath: path.join(normalizedRoot, ".grape", "config.json"),
    databasePath: path.join(normalizedRoot, ".grape", "grape.db"),
    artifactDirPath: path.join(normalizedRoot, ".grape", "artifacts"),
    createdDirs
  };
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
  if (parsed.schemaVersion !== localProjectSchemaVersion) {
    throw new Error(`unsupported Grape config schema version: ${String(parsed.schemaVersion)}`);
  }
  if (!parsed.project?.projectId || !parsed.project.repoId || !parsed.project.rootPath) {
    throw new Error("Grape config is missing project identity.");
  }

  return parsed as LocalProjectConfig;
}

export function writeLocalProjectConfig(
  configPath: string,
  config: LocalProjectConfig
): "created" | "unchanged" {
  if (existsSync(configPath)) {
    const existing = readLocalProjectConfig(configPath);
    if (existing?.project.projectId !== config.project.projectId || existing.project.repoId !== config.project.repoId) {
      throw new Error("existing Grape config points at a different project or repository.");
    }
    return "unchanged";
  }

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return "created";
}
