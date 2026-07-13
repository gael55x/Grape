import {
  ensureLocalProjectLayout,
  isRepairableLocalProjectConfigError,
  readLocalProjectConfig
} from "./config.js";
import { resolveExistingGitRoot } from "./existing-layout.js";
import { initializeLocalProject } from "./initialize.js";

export interface EnsureLocalProjectBootstrappedInput {
  readonly rootPath: string;
  readonly now: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export function ensureLocalProjectBootstrapped(input: EnsureLocalProjectBootstrappedInput): void {
  const rootPath = resolveExistingGitRoot(input.rootPath, input.gitBinary);
  const layout = ensureLocalProjectLayout(rootPath);
  let config: ReturnType<typeof readLocalProjectConfig>;
  try {
    config = readLocalProjectConfig(layout.configPath);
  } catch (error) {
    if (!isRepairableLocalProjectConfigError(error)) throw error;
    initializeLocalProject({
      rootPath,
      connect: false,
      now: input.now,
      gitBinary: input.gitBinary,
      migrationsDir: input.migrationsDir
    });
    return;
  }
  if (config) return;

  initializeLocalProject({
    rootPath,
    connect: false,
    now: input.now,
    gitBinary: input.gitBinary,
    migrationsDir: input.migrationsDir
  });
}
