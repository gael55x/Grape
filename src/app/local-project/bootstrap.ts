import { createGitRepoSnapshot } from "../../core/git/index.js";
import { ensureLocalProjectLayout, readLocalProjectConfig } from "./config.js";
import { initializeLocalProject } from "./initialize.js";

export interface EnsureLocalProjectBootstrappedInput {
  readonly rootPath: string;
  readonly now: string;
  readonly gitBinary?: string;
  readonly migrationsDir?: string;
}

export function ensureLocalProjectBootstrapped(input: EnsureLocalProjectBootstrappedInput): void {
  const snapshot = createGitRepoSnapshot({
    rootPath: input.rootPath,
    createdAt: input.now,
    gitBinary: input.gitBinary
  });
  const layout = ensureLocalProjectLayout(snapshot.rootPath);
  const config = readLocalProjectConfig(layout.configPath);
  if (config) return;

  initializeLocalProject({
    rootPath: snapshot.rootPath,
    connect: false,
    now: input.now,
    gitBinary: input.gitBinary,
    migrationsDir: input.migrationsDir
  });
}
